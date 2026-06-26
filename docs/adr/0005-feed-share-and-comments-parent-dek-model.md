# 0005. Feed share and comments: `parentMessageId`, shared DEK, and delivery isolation

- **Status:** Accepted
- **Date:** 2026-06-24

## Context

Feed posts use envelope encryption (ADR 0003): one random AES-256 **message DEK** encrypts `encryptedContent` once; each recipient gets an ECDHE-wrapped shard in `keyManifest`. Everyone who unwraps the DEK reads the **same plaintext**.

The product extends that model in two directions:

1. **Share** - grant additional recipients access to an existing post **without re-encrypting the body**. The sharer unwraps the parent DEK from their own delivery shard, then runs a **new** ephemeral ECDHE wrap for the selected recipients.
2. **Comments** - encrypt discussion text under the **same parent DEK**, via a separate HKDF step. Comments do not add recipients to the parent `keyManifest` and do not re-wrap the DEK for others.

Both features must anchor to the **original feed post** in local storage. IndexedDB is the source of truth for identity: `parentMessageId` is the **local row id** of the original post, not a portable content fingerprint and not embedded parent payloads in export files.

Today, share deliveries and original posts live in the same `messages` object store (`StoredMessage.parentMessageId` distinguishes share rows). Comments live in a separate `comments` store keyed by `messageId` (the parent’s local id).

## Decision

### Shared rules

| Concept             | Rule                                                                                                                                                                                                                                                                                               |
| ------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| **Parent anchor**   | `parentMessageId` always refers to the **original post’s local id** in IndexedDB (the thread root from `getCommentThreadMessageId`).                                                                                                                                                               |
| **Message DEK**     | One DEK per post body (`encryptedContent`). Share and comment flows **reuse** that DEK; they do not mint a new post-body DEK.                                                                                                                                                                      |
| **Export / import** | Share export: `{ share, keyManifest }` with signed `share.parentMessageId`. Comment export: signed `CommentPayload` JSON (includes `parentMessageId`). Original post export includes `messageId`. Import resolves the parent with `getStoredMessageById(parentMessageId)`; missing parent → error. |
| **Who may comment** | Original sender or anyone with parent access via an original shard or any share delivery shard (`canCommentOnParentMessage`).                                                                                                                                                                      |

### Share

- **Wire payload** (`ManifestShareWirePayload`): signed metadata only - `parentMessageId`, `sharerPublicJwk`, `ephemeralPublicKey`, `sharerSignature`. No `keyManifest` in the core; shards ship beside it on export/import.
- **Storage**: new row in `messages` with `parentMessageId` set; share core in `payload`; per-recipient shards in `message_key_manifest` keyed by the **share delivery id** (not the parent id).
- **DEK path**: sharer calls `decryptParentMessageDekFromDelivery` (parent row + whichever delivery row holds their shard), then `buildManifestShare` re-wraps that **same raw DEK** under a **fresh** ephemeral key pair for new recipients (`MANIFEST_SHARE_WRAP`).
- **Parent ciphertext unchanged**: `encryptedContent` on the parent row is never rewritten. New recipients decrypt the parent body using their shard on the **share delivery** and the parent’s public core.

### Comments

- **Wire payload** (`CommentPayload`): signed body includes `parentMessageId` (local parent id), `senderPublicJwk`, random `salt`, and comment `encryptedContent`.
- **Storage**: `comments` store - `(id, messageId → parent local id, payload, createdAt)`.
- **DEK path**: author unwraps parent DEK via their shard (`decryptParentMessageDekForRecipient`), imports DEK bytes as HKDF key material, derives a **comment key** with `HKDF(DEK, salt, info=comment-v1:content)`, encrypts comment plaintext. Recipients with parent access repeat the same derivation using the salt on the wire.
- **No second ECDHE round** for comments; no change to parent `keyManifest` when commenting.

```
Parent post (id = P)
  encryptedContent  ← AES-GCM(message DEK)
  keyManifest[P]      ← shards for original recipients

Share delivery (id = S, parentMessageId = P)
  share core          ← ephemeralPublicKey, sharerSignature, parentMessageId = P
  keyManifest[S]      ← shards for newly shared recipients (same message DEK)

Comment (messageId = P)
  comment.encryptedContent ← AES-GCM(commentKey)
  commentKey               ← HKDF(message DEK, salt)
```

## Why re-wrapping the DEK in share is safe (ECDHE setup)

Sharing does **not** send the raw DEK in the export file. The sharer only ever distributes **another ECDHE-wrapped shard**, using the same pattern as original posts (ADR 0003):

1. Sharer unwraps parent DEK locally using **their** private key and a delivery shard they already hold.
2. Client generates a **one-time** `ephemeral_private` for this share operation.
3. For each new recipient (plus sharer as recipient):  
   `KEK = HKDF(ECDHE(ephemeral_private, recipient_public), per-recipient salt)`  
   `shard.encryptedDek = AES-GCM(KEK, message DEK)`
4. `ephemeral_private` is discarded; only `ephemeralPublicKey` appears in the signed share core.

**Safety properties in this design:**

- **Confidentiality of the DEK on the wire**: export/import carries wrapped shards, not the DEK. An eavesdropper without a recipient private key cannot unwrap.
- **Binding to intended recipients**: each shard is addressed to one `keyId` (thumbprint of recipient public key). Wrong key → GCM failure.
- **No sharer long-term key as universal opener**: shards use the **ephemeral** agreement key from this share event, not `ECDH(sharer_long_term_private, recipient_public)`. A leaked sharer signing/ECDH identity key does not, by itself, unwrap other users’ share shards (see ADR 0003 threat table).
- **Parent body integrity**: parent `encryptedContent` and `senderSignature` are untouched; share signature covers share metadata only. Tampering with parent ciphertext is detected when verifying the parent manifest before decrypt.
- **Same plaintext for all recipients**: intentional - share extends **who** can unwrap the existing DEK, not **what** the DEK encrypts.

**What sharing does not provide:**

- Forward secrecy for the post body after share (parent core and shards are stored).
- Protection if a **new recipient’s** long-term private key is compromised (their share shard decrypts like any other shard).
- Hiding the parent post from someone who already had the DEK via an earlier delivery.

## Consequences

### Positive

- One DEK and one `encryptedContent` per post - simple mental model; share is ACL extension, comments are DEK-derived overlays.
- `parentMessageId` gives a stable thread key for inbox deduplication (`filterFeedInboxMessages`), comment listing, and share validation.
- Share re-wrap aligns with ADR 0003 ECDHE threat model (especially sharer ≠ original sender).
- Storage split (core / shards / comments) maps cleanly to ACL-backed backend.

### Negative / limitations

- `parentMessageId` in export files is **local** to the exporter’s database; recipients must already have the parent row with the same id (or import the original with `messageId` first).
- **Comment confidentiality is tied to parent DEK access, not per-comment ACL** (by design). See [Comment visibility model](#comment-visibility-model) below.
- Share and parent rows currently share one IndexedDB store - harder to enforce invariants and retention policies separately (TODO action item).

### Comment visibility model

A **thread** is one original feed post (`parentMessageId` / `messageId` = local id `P`) plus all **comments** stored with `messageId = P`. Anyone who can unwrap the parent message DEK is in the same **cryptographic thread**: they use that DEK (and each comment’s public `salt`) to derive the comment key and decrypt every comment on the post.

**What “thread membership” means here:** not a separate invite list, but “holds a shard that opens the parent DEK” - original recipient, sender (via their shard), or someone who received a **share** delivery for that post.

**What is revealed to everyone in that set:**

| Visible                      | How                                                                                                 |
| ---------------------------- | --------------------------------------------------------------------------------------------------- |
| That the thread has comments | Comment rows exist (count, `createdAt`); inbox UI shows comment counts.                             |
| Who wrote each comment       | `senderPublicJwk` is in the signed comment payload (thumbprint → author identity).                  |
| Full comment plaintext       | `commentKey = HKDF(parent DEK, salt)` - same DEK for all comments on the post; salt is on the wire. |
| Thread linkage               | `parentMessageId` in each comment binds it to post `P`; exports are the signed comment payload.     |

**What is not hidden from thread members:**

- Per-comment encryption does **not** add new `keyManifest` recipients or a second ECDHE wrap. Comments are **not** “DMs under the post”; they are encrypted overlays on the **same** access plane as the parent body.
- A user who gains access only via a **later share** can decrypt **all existing comments** on that post, not only comments written after they were shared.
- Comment authors cannot restrict readership to a subset of parent recipients (e.g. hide a reply from one co-recipient).

**What remains protected (outside the thread):**

- Users **without** the parent DEK (no original shard, no share shard) cannot decrypt the post or any comment, even if they obtain comment ciphertext or exports.
- Comment **integrity** for participants: `senderSignature` covers the comment body; tampering is detected before decrypt.

This matches the product goal: comments are discussion on a shared encrypted post, not a separate encrypted channel. Tighter isolation (per-comment recipient lists) would require re-wrapping or different keys per comment - explicitly out of scope for v1 (`COMMENT_WRAP = message-bound-aes`).

## Alternatives considered

### Embed full parent manifest in share/comment export

- Portable cross-device import without prior parent row.
- **Rejected:** IndexedDB local ids are the source of truth; embedding parent duplicates storage and complicates deduplication. Parent must exist before share/comment import. This behaviour mimics future backend.

### Re-encrypt post body for each share recipient

- New `encryptedContent` per recipient.
- **Rejected:** multiplies ciphertext size, breaks single feed card per post, and is unnecessary when DEK wrapping already grants access.

### Static ECDH for share wraps only

- **Rejected:** see ADR 0003 - sharer long-term key must not unwrap recipient shards on the server.

### Comment-specific ECDHE wrap per reader

- **Rejected:** anyone with parent DEK can already read all comments; extra wraps add complexity without meaningful isolation in the current threat model.

## References

- Related ADRs:
  - [0003](./0003-ephemeral-sender-ecdhe-for-key-manifest-shards.md) - ECDHE wrap pattern and shard binding
  - [0004](./0004-main-process-owns-external-file-reads.md) - share/comment file import via main process
