# 0008. Citus sharding by cryptographic key id

- **Status:** Accepted
- **Date:** 2026-07-02

## Context

The feed API (`apps/api`) stores end-to-end encrypted posts, shares, comments, per-recipient manifest shards, user public keys, and friendship data. The dominant read path is **inbox assembly for one authenticated recipient**: list manifest shards addressed to that `keyId`, then load the related message, share, and comment rows by id.

Manifest shards are the ACL layer (ADR 0003): one row per `(parent_message_id, recipient_key_id)` (and optional `share_id` for share deliveries). Shard volume grows with **recipients × deliveries** and will exceed every other table at scale.

We chose **Citus** on PostgreSQL so we can scale horizontally without abandoning Prisma, migrations, or SQL semantics. After Prisma migrations, `apps/api/prisma/citus/distribute.sql` declares which tables are **reference** (replicated to all workers) and which are **hash-distributed** (partitioned by a distribution column).

Identity in the API is the EC P-256 `keyId` thumbprint (ADR 0007). Distribution keys should align with how callers authenticate and which rows they are allowed to read.

## Decision

### Distribution layout

| Table                         | Citus role                  | Distribution / access key | Rationale                                                                                                                                          |
| ----------------------------- | --------------------------- | ------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------- |
| `message_key_manifest_shards` | **Distributed**             | `recipient_key_id`        | Inbox and shard ACL queries filter on the authenticated recipient’s `keyId`. Highest cardinality; primary scaling target.                          |
| `user_friendships`            | **Distributed** (colocated) | `owner_key_id`            | `GET /friendships` lists edges where the caller is owner. Colocated with manifest shards so owner/recipient key lookups hit the same worker shard. |
| `users`                       | **Reference**               | —                         | Small, joined from many paths (registration checks, friendship public-key hydration).                                                              |
| `messages`                    | **Reference**               | —                         | Loaded by UUID after shard resolution; ciphertext blobs are not sharded by recipient.                                                              |
| `shares`                      | **Reference**               | —                         | Same as messages: fetch by share id from inbox assembly.                                                                                           |
| `comments`                    | **Reference**               | —                         | Fetched by parent `message_id`; volume lower than shards.                                                                                          |
| `friendship_requests`         | **Reference**               | —                         | Low volume; queried by `requester_key_id` or `target_key_id` (not a single owner column).                                                          |

```sql
-- apps/api/prisma/citus/distribute.sql (abbreviated)
PERFORM create_distributed_table('message_key_manifest_shards', 'recipient_key_id');
PERFORM create_distributed_table(
  'user_friendships', 'owner_key_id',
  colocate_with => 'message_key_manifest_shards'
);
-- users, messages, shares, comments, friendship_requests → create_reference_table(...)
```

### Why shard on key ids (not message ids)

1. **Matches authenticated access patterns.** After ADR 0007, every mutating and inbox read is scoped to one `keyId`. `listDeliveryIdsForRecipientKeyId` and `listFriendshipsForOwner` are single-shard when filtered on the distribution column.
2. **Aligns with the ACL model.** Shards are per recipient; co-locating recipient-owned rows (manifest entries + friendship list) keeps related user state on one worker.
3. **Message-id sharding would scatter a recipient’s inbox.** A user’s deliveries span many parent messages; inbox listing would require a scatter-gather across all workers on every poll.
4. **Content tables are secondary lookups.** Once shard rows identify delivery ids, `messages` / `shares` / `comments` are point reads by primary key. Replicating those tables is cheaper than repartitioning them for rare cross-message analytics we do not run on the API.

### Why manifest shards and friendships are distributed

- **Write amplification:** each post or share inserts N shard rows (one per recipient). This table dominates storage and insert rate.
- **Read fan-in:** inbox sync touches many shard rows for one `recipient_key_id` but does not scan other recipients’ shards.
- **Friendships:** stored as directed edges `(owner_key_id, friend_key_id)` with symmetric pairs on accept. Owner-scoped listing is the hot path; distributing by `owner_key_id` keeps it colocated with that owner’s manifest shards.

### Why the other tables are reference tables

- **Join locality:** workers can resolve `users.key_id` and message UUIDs locally after fetching shard rows, without repartitioning broadcasts.
- **Simple Prisma queries:** existing `findUnique` / `findMany` by id or small `in` lists work unchanged on reference data.
- **Operational fit:** user count and encrypted payload tables are expected to stay **medium-sized** relative to shard count (see consequences below). Reference tables are appropriate while full copies fit comfortably in worker memory and disk budgets.

### Citus-specific schema constraints

- **No FK from `message_key_manifest_shards.recipient_key_id` → `users.key_id`.** Citus cannot enforce that foreign key on the distribution column the way a single-node Postgres deployment would. Registration is enforced in application code (`assertRecipientsRegistered`).
- **Distribution runs after migrations** via `npm run db:citus:distribute` (or `db:setup` in Docker). The script is idempotent.

## Consequences

### Positive

- Inbox and friendship list queries for one authenticated `keyId` route to a single worker shard (when filtered on the distribution column).
- Manifest shard growth can be scaled out by adding Citus workers without redesigning the envelope encryption model.
- Reference tables keep id-based lookups for messages, shares, and users simple and local on each worker.
- Colocation of `user_friendships` with `message_key_manifest_shards` avoids cross-shard joins for owner-scoped social + delivery state on the same key id.

### Negative / limitations

- **Medium-sized reference tables — replication cost.** Every worker holds a full copy of `users`, `messages`, `shares`, `comments`, and `friendship_requests`. Storage and buffer-cache footprint scale with **worker count × table size**, not with shard count alone.
- **Medium-sized reference tables — write path.** Inserts and updates to reference tables go through the coordinator and are replicated to all workers. A burst of new posts updates one replicated `messages` row everywhere; this is acceptable at medium scale but becomes a bottleneck if the feed table grows large.
- **Medium-sized reference tables — sweet spot vs cliff.** “Medium” here means: total reference data remains small enough (typically sub‑GB to low tens of GB per table in aggregate) that broadcasting is cheaper than redesigning queries. If `messages` / `shares` grow to very large cardinality, reference placement will need revisiting (e.g. distribute by `id`, object storage for payloads, or archival).
- **Medium-sized reference tables — positive side of the trade.** For our access pattern, replication avoids expensive reshuffles: inbox already found the relevant ids on the distributed shard; workers then resolve ciphertext rows locally. That is often faster and simpler than distributing messages by `id` and joining across shards for every recipient poll.
- **Friendship symmetry** requires two distributed rows per pair (`A→B` and `B→A`). Deletes use `deleteMany` with `OR` across both orientations (potential multi-shard write).
- **`friendship_requests` on both key columns** does not map cleanly to one distribution key; keeping it reference accepts full-table replication in exchange for simple pending-request queries at low volume.
- **No database-enforced shard recipient validity** without the dropped FK; bad `recipient_key_id` values are rejected in the app layer only.

## Alternatives considered

### Distribute `messages` (and shares) by `id`

- **Rejected for now:** inbox never scans all messages; it loads a small id set per recipient. Reference replication is simpler and matches the shard-then-lookup flow. Revisit if message table size dominates cluster memory.

### Distribute `friendship_requests` by `target_key_id` or `requester_key_id`

- **Rejected:** incoming and outgoing pending lists use different columns. One distribution key would scatter half the queries. Volume is low enough that a reference table is acceptable.

### Single-node PostgreSQL (no Citus)

- **Rejected for production path:** shard table growth is the expected limiter; Citus keeps the relational model while allowing horizontal scale. Local Docker still uses Citus to mirror production topology.

### Application-level sharding or a non-SQL store for shards

- **Rejected:** would split transactional guarantees for posts + shards + friendships and complicate Prisma. Citus keeps one SQL database with declarative distribution.

## References

- Docker: `docker/README.md` (verify distribution with `pg_dist_partition`)
- Related ADRs: [0003](./0003-ephemeral-sender-ecdhe-for-key-manifest-shards.md), [0005](./0005-feed-share-and-comments-parent-dek-model.md), [0007](./0007-api-authentication-with-time-slot-ecdsa-proofs.md)
