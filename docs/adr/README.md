# Architecture Decision Records (ADR)

This folder documents significant architectural and security decisions for the Encrypt app.

An ADR captures **why** a decision was made, not only **what** was implemented. Accepted ADRs are not rewritten in place: add a new ADR for the change, and record deltas in a **`## Changes`** section on the older ADR (see [0001](./0001-use-architecture-decision-records.md)). Fully replaced decisions get status **Superseded by NNNN**.

## Index

| ADR | Title | Status |
|-----|-------|--------|
| [0001](./0001-use-architecture-decision-records.md) | Use Architecture Decision Records | Accepted |
| [0002](./0002-in-memory-non-extractable-private-key-cache.md) | In-memory non-extractable private key cache | Accepted |
| [0003](./0003-ephemeral-sender-ecdhe-for-key-manifest-shards.md) | Ephemeral sender ECDHE for key-manifest shards | Accepted |
| [0004](./0004-main-process-owns-external-file-reads.md) | Main process owns external file reads (no path-based IPC from renderer) | Accepted |
| [0005](./0005-feed-share-and-comments-parent-dek-model.md) | Feed share and comments: `parentMessageId`, shared DEK, and delivery isolation | Accepted |
| [0006](./0006-known-dek-does-not-recover-recipient-private-key.md) | Known DEK and message material do not recover a recipient’s private key | Accepted |
| [0007](./0007-api-authentication-with-time-slot-ecdsa-proofs.md) | API authentication with time-slot ECDSA proofs | Superseded by [0009](./0009-api-authentication-with-server-minted-redis-nonces.md) |
| [0008](./0008-citus-sharding-by-key-id.md) | Citus sharding by cryptographic key id | Accepted |
| [0009](./0009-api-authentication-with-server-minted-redis-nonces.md) | API authentication with server-minted Redis nonces | Accepted |
| [0010](./0010-challenge-reuses-pending-auth-nonce.md) | Challenge reuses pending auth nonce | Accepted |
| [0011](./0011-auth-nonce-expires-at-on-rotation.md) | Auth nonce `expiresAt` on rotation and stable Redis expiry | Accepted |
| [0012](./0012-auth-nonce-consumed-before-route-validation.md) | Auth nonce consumed before route validation | Accepted |

## When to write an ADR

Write an ADR when a decision:

- affects security, privacy, or key handling
- is hard to reverse or expensive to change later
- has meaningful trade-offs that future contributors should understand
- was debated or rejected alternatives deserve a paper trail

Skip ADRs for routine refactors, dependency bumps, or obvious bug fixes.

## File naming

```
docs/adr/NNNN-short-title-in-kebab-case.md
```

- `NNNN` — four-digit sequence (`0001`, `0002`, …)
- `short-title-in-kebab-case` — a few words describing the topic

## Status values

| Status | Meaning |
|--------|---------|
| **Proposed** | Under discussion; not yet implemented |
| **Accepted** | Decision is in effect |
| **Deprecated** | No longer recommended; replacement ADR should exist |
| **Superseded by [NNNN](./NNNN-….md)** | Replaced by a newer ADR |

## Template

Copy this when adding a new ADR:

```markdown
# NNNN. Title

- **Status:** Proposed | Accepted | Deprecated | Superseded by [NNNN](./NNNN-….md)
- **Date:** YYYY-MM-DD
- **Authors:** (optional)

## Context

What problem or constraint led to this decision?

## Decision

What we chose to do.

## Consequences

### Positive

- …

### Negative / limitations

- …

## Alternatives considered

### Option A

- …

### Option B

- …

## Changes

(optional — append when later ADRs refine this one; do not rewrite **Decision** above)

### YYYY-MM-DD — [NNNN](./NNNN-short-title.md)

| Topic | As accepted | Current |
| ----- | ----------- | ------- |
| …     | …           | …       |

## References

- Code: `src/…`
- Related ADRs: …
```

## Process

1. Copy the template into `docs/adr/NNNN-your-title.md`.
2. Set status to **Proposed** while reviewing.
3. After implementation (or explicit agreement), set status to **Accepted** and add a row to the index table above.
4. To change a past decision, add a new ADR. Append a dated **`## Changes`** subsection on the older ADR (minimal edits to the original text). Mark **Superseded by NNNN** only when the old ADR is fully replaced.
