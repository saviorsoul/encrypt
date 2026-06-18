# 0003. Ephemeral sender ECDHE for key-manifest shards

- **Status:** Accepted
- **Date:** 2026-06-18

## Context

Feed messages use envelope encryption: a random AES-256 DEK encrypts the post body once (`encryptedContent`), and each intended recipient gets a **shard** - their own wrapped copy of that DEK in `keyManifest`.

The app already splits storage along recipient boundaries:

- **Core payload** (public on the feed): `senderPublicJwk`, `ephemeralPublicKey`, `encryptedContent`, `senderSignature`
- **Per-recipient shard** (private delivery): one `KeyManifestRecipientPayload` per `keyId`, stored as `(messageId, keyId)` in IndexedDB today and intended to be ACL-scoped on a future backend

See `splitManifestForStorage`, `StoredMessageKeyManifestShard`, and `assembleManifestForRecipient`.

The sender is always included as a recipient (`recipientsIncludingSender`) so they can decrypt their own posts later, comment, and share. That means every party reads the **same DEK** and the same plaintext; shards are not hiding different content per recipient.

We needed to choose how each shard’s KEK is derived:

- **Static ECDH:** `ECDH(sender_long_term_private, recipient_public)` on wrap; unwrap with `ECDH(recipient_private, sender_public)` or the same sender-side path.
- **Ephemeral sender ECDHE (chosen):** generate a one-time agreement key pair per post or share delivery; wrap with `ECDH(ephemeral_private, recipient_public)`; store only `ephemeralPublicKey` in the core payload; discard `ephemeral_private` after wrapping completes.

The decision must be justified for **this app’s feed, comments, and sharing model**, especially when the backend enforces ACLs so each user receives only their own shard - not from generic TLS-style forward-secrecy arguments, and not from the false claim that ECDHE hides different plaintext per recipient (everyone unwraps the same DEK).

## Decision

Use **ephemeral sender ECDHE** for all DEK wrapping:

- Feed posts: `MANIFEST_WRAP = 'ephemeral-sender-ecdhe-hkdf-aes'` (`manifestConstants.ts`)
- Share deliveries: fresh ephemeral key pair per share (`buildManifestShare`)
- Flow: `ECDHE → HKDF (per-recipient salt) → KEK → AES-GCM wrap of DEK`

Long-term user keys remain for:

- **ECDSA signing** (`senderPublicJwk` / `sharerPublicJwk`)
- **Recipient-side unwrap** (`recipient_private × ephemeral_public` from the core payload)

The ephemeral private key exists only in memory during encrypt/share and is never persisted or sent to the server.

### What this does in our app

```
Encrypt / share (client, once per delivery)
  ephemeral_private × recipient_public → shared secret
  HKDF(shared secret, per-recipient salt) → KEK
  AES-GCM(KEK, DEK) → shard.encryptedDek

Feed core (same for all viewers)
  ephemeralPublicKey, encryptedContent, senderPublicJwk, senderSignature

Shard for Bob only (ACL-scoped delivery)
  { salt, iv, encryptedDek, publicKey: Bob_public }

Decrypt (Bob)
  Bob_private × ephemeralPublicKey → same shared secret → KEK → DEK → plaintext
```

Comments do not run a second ECDHE round; authors recover the parent DEK through their shard (or a share delivery shard) and derive a comment key with `HKDF(DEK, salt)` (`commentCrypto.ts`).

### How this helps with future backend ACLs

The benefit is **not** “recipients see different content.” Everyone who unwraps the DEK reads the same `encryptedContent`. The benefit is **which private key opens which server-stored shard** - cryptographic backing for ACL-scoped delivery records.

ECDHE enforces:

> **Opening Bob’s server-stored shard requires Bob’s long-term private key (or the discarded ephemeral wrap key from encrypt time). It must not be sufficient to have the sender’s long-term private key alone.**

With static sender×recipient ECDH, an attacker who obtains the sender’s leaked private key and Bob’s shard (from a server breach, misconfiguration, or coercion) can compute `ECDH(sender_private, Bob_public)` using `publicKey` inside Bob’s shard and unwrap the DEK **without Bob’s private key**.

With ephemeral sender ECDHE, that sender-side path does not exist. The shard was wrapped with `ephemeral_private`, which is gone after encrypt. Unwrapping Bob’s shard requires `Bob_private` (or brute-forcing the per-delivery ephemeral private key).

The same property applies to **share deliveries**: a leaked sharer key must not automatically open shards addressed to new recipients on the server.

### Where ECDHE adds little value (sender-as-recipient)

The sender is always included as a recipient and their shard is stored for later decrypt, comment, and share flows. That collapses much of the **post plaintext** advantage of ECDHE on original posts:

| Attacker has                                                        | Static ECDH                                                     | ECDHE    |
| ------------------------------------------------------------------- | --------------------------------------------------------------- | -------- |
| `Alice_private` + Alice’s shards (normal ACL access to her account) | Reads all posts Alice sent, via Alice’s shard → same DEK as Bob | **Same** |

An attacker in that position never needs Bob’s shard to read what Bob saw. Unwrapping Bob’s server-held shard with `Alice_private` under static ECDH would yield the **same plaintext** they already get from Alice’s shard.

So ECDHE is **not** primarily justified as “stop an Alice-key attacker from reading outbound post content.” It is justified for:

1. **Shard binding** - Bob’s delivery record on the server requires Bob’s key, not Alice’s (relevant for malicious/coerced server, partial DB leaks, and ACL semantics).
2. **Sharing** - sharer is often not the original sender; `Alice_private` does not help unwrap Dave’s shard on Bob’s share delivery; ECDHE vs static still matters for **sharer key leak + recipient shards**.
3. **Defense in depth** - when the server holds other users’ shards without the sender’s shard (breach partitioning, ACL bugs).
4. **Optional future** - sender shard not stored on the backend (would make ECDHE essential for cross-user shard isolation).

### Threat summary (original post vs share)

| Threat                                                                    | ECDHE benefit over static ECDH?                                       |
| ------------------------------------------------------------------------- | --------------------------------------------------------------------- |
| `Alice_private` + Alice’s shards (honest ACL)                             | **Little / none** for post plaintext                                  |
| `Bob_private`                                                             | **No difference**                                                     |
| `Bob_private` + Dave’s shard on Bob’s share delivery                      | **Yes** (static sharer wrap opens Dave’s shard with sharer key alone) |
| Malicious server: Bob’s shards + coerced `Alice_private`, no Alice shards | **Yes**                                                               |
| Malicious server: **all** shards + `Alice_private`                        | **Little** for Alice-sent post plaintext                              |
| Future: no sender shard on server                                         | **Yes, strongly**                                                     |

### Brute-force and guess-and-verify attacks

ECDHE does **not** increase the raw cryptographic work factor: P-256 private keys still have roughly **128-bit** classical security against ECDLP, and AES-256 DEK/KEK brute force remains infeasible. The benefit is **which key an attacker must target** and **how much one successful guess unlocks**.

With **static sender×recipient ECDH**, the HKDF input for every wrap between the same two users is identical:

```text
shared_secret(Alice, Bob) = ECDH(Alice_private, Bob_public)   // same for every post
KEK = HKDF(shared_secret, per-message salt)
```

Per-message random salts still produce different KEKs, but they do **not** hide the shared secret. If an attacker learns `Alice_private`, they can recompute `shared_secret(Alice, Bob)` once and unwrap **every historical Bob shard** from the server - **but that only adds access beyond Alice’s own shards when those Bob shards are available to the attacker** (see [Where ECDHE adds little value](#where-ecdhe-adds-little-value-sender-as-recipient)).

Reusing the same shared secret across many messages does **not** make ECDLP brute force exponentially easier (~128-bit for P-256 remains). It **does** amortize the payoff of one successful sender-key guess across all server-held recipient shards for that pair.

#### Guess-and-verify against server-held shards

The practical offline attack is not enumerating all 2^256 AES keys. It is:

```text
for candidate_private_key:
    shared = ECDH(candidate, public_key_from_shard_or_core)
    kek = HKDF(shared, salt_from_shard)
    if AES-GCM-decrypt(shard.encryptedDek, kek, shard.iv) succeeds:
        candidate is correct (or collision); recover DEK
```

AES-GCM tag verification is a reliable oracle.

| Attacker guess      | Static ECDH - test against Bob’s shard        | ECDHE - test against Bob’s shard                               |
| ------------------- | --------------------------------------------- | -------------------------------------------------------------- |
| `Alice_private`     | **Succeeds** (`Bob_public` is in Bob’s shard) | **Fails** (wrap used `ephemeral_private`, not `Alice_private`) |
| `Bob_private`       | Succeeds (`senderPublicJwk` in core)          | Succeeds (`ephemeralPublicKey` in core)                        |
| `ephemeral_private` | N/A                                           | Succeeds for **that delivery only** (`Bob_public` in shard)    |

So static ECDH turns a sender-key search into a valid attack path against **other recipients’** ACL-scoped shards. ECDHE removes that path; the attacker must target each recipient’s long-term key or each delivery’s ephemeral private key separately.

#### Blast radius after a successful break

| Broken key                               | Static ECDH                                                                                                                                                  | Ephemeral sender ECDHE                                                                                                            |
| ---------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------ | --------------------------------------------------------------------------------------------------------------------------------- |
| Sender `Alice_private`                   | Unwraps **all** server-held shards for every recipient Alice ever messaged (via sender-side `ECDH(Alice_private, recipient_public)`); also forges signatures | Unwraps only **Alice’s own** shards (sender-as-recipient path); does **not** unwrap Bob’s/Carol’s shards; still forges signatures |
| Recipient `Bob_private`                  | Unwraps all Bob shards (posts and share deliveries addressed to Bob)                                                                                         | Same                                                                                                                              |
| One `ephemeral_private` (per post/share) | N/A                                                                                                                                                          | Unwraps shards for **that delivery only**; must repeat per message                                                                |

Static ECDH therefore **amortizes** a single successful sender-key guess across the full history of outbound wraps to each recipient. ECDHE forces separate work per recipient long-term key or per delivery ephemeral key.

#### Recipient brute force (unchanged by this ADR)

Guessing `Bob_private` against Bob’s shard works in **both** designs. ECDHE does not harden a recipient’s own shard against brute force on that recipient’s key. That is expected: Bob’s shard is meant to open with Bob’s key.

#### Sender brute force when attacker has only the sender’s ACL-visible data

When the attacker has `Alice_private` and can fetch only Alice’s shards (honest backend ACLs), both designs yield the same post plaintext: same DEK inside Alice’s shard. ECDHE does not add brute-force resistance in that scenario.

The gain appears when the attacker also has **other users’ shards** (breach, insider, coercion) or is guessing sender keys **against those shards** as verification oracles - not when the attacker already has the sender’s own shards and only cares about post content Alice sent.

#### Malicious server with full history (e.g. 100 messages, same pair)

A server holding all cores and all shards for 100 Alice→Bob posts does not get a meaningfully shorter ECDLP search because the pairwise shared secret is reused under static ECDH: wrong key candidates still fail GCM checks; right candidate is confirmed from any one shard. The regression under static ECDH is **coverage after compromise** (one `shared_secret(Alice, Bob)` unwraps all 100 Bob shards) and **sender-key guessing against Bob’s shards**, not a drop from 128-bit to a weaker brute-force regime. If the attacker also has all Alice shards and `Alice_private`, both designs expose the same 100 post bodies via Alice’s path.

### What this does not protect

These limits are intentional given the feed design and must not be overstated in docs or UI:

1. **Sender key leak + sender’s own shard (primary account-compromise case).** The sender is always a recipient. An attacker with the sender’s private key and the sender’s shard (normal under ACLs for that user) recovers the same DEK and reads the same plaintext other recipients see. **ECDHE does not prevent that** - this is the main scenario where the extra wrap step does not improve post confidentiality.

2. **TLS-style forward secrecy.** `ephemeralPublicKey` is stored in every core payload, and wrapped DEKs are stored per recipient. Past posts remain decryptable by anyone who holds the right recipient private key and their shard.

3. **Recipient key leak.** If Bob’s private key is compromised, Bob’s shards decrypt regardless of ECDHE.

4. **`keyManifest` is outside the signature.** `manifestSignableBodyForSigning` covers `encryptedContent` and `ephemeralPublicKey`, not shards. Integrity of shard delivery is a separate trust assumption on the backend.

## Consequences

### Positive

- Each recipient’s shard is cryptographically bound to that recipient’s long-term ECDH private key, matching the intended ACL model (server holds shards; only the recipient key opens that shard).
- A leaked sender or sharer long-term key cannot be used as a master unwrap key against **other users’** server-held shards (meaningful when those shards are available without the sender’s own shard).
- One consistent wrap pattern for feed posts and share deliveries (`derivePerRecipientKek`, `generateManifestEphemeralAgreementKeyPair`), including **share** paths where the wrapping party is not the original post author.
- Signing identity stays off the outbound wrap path during encrypt; long-term material is used as recipient identity and for ECDSA.
- Per-delivery ephemeral agreement material limits blast radius of a successful break to one wrap operation (vs one static pairwise secret reused across all messages between the same two keys).
- Sender-key guessing cannot be amortized across other recipients’ server-held shards via AES-GCM decrypt-oracle checks on those shards.

### Negative / limitations

- Core payload carries an extra field (`ephemeralPublicKey`) and the step-by-step encrypt UI documents an additional agreement step - with **limited post-plaintext benefit** when sender-as-recipient and the sender’s shard stay on the server (see [Where ECDHE adds little value](#where-ecdhe-adds-little-value-sender-as-recipient)).
- Sender must retain access via their own shard on the server (or another supported delivery), not via the ephemeral private key.
- Capture of the client at encrypt time (memory compromise) can still recover `ephemeral_private` for that delivery.
- Does not replace ACL enforcement; it gives cryptographic backing when ACLs are the primary access control on shard delivery.

## Alternatives considered

### Static ECDH with sender long-term private key

Wrap with `ECDH(sender_private, recipient_public)`; unwrap with `ECDH(recipient_private, sender_public)` where `senderPublicJwk` is already in the core payload. The pairwise `shared_secret(sender, recipient)` is **fixed for the lifetime of those keys** and reused on every message.

- **Rejected:** with per-recipient shard ACLs, the sender’s long-term private key becomes a universal opener for every other recipient’s shard stored on the backend. That matters for shard binding, sharing, and server-side threat models - **not** because recipients would otherwise see different plaintext (same DEK everywhere).
- **Rejected (account compromise on original posts):** if the threat model is only “stolen sender key + sender’s own shards,” static ECDH would expose the same post bodies with simpler wire format. We still reject it because sharing, sharer-key leak, and cross-user shard isolation remain requirements.
- **Rejected (brute force):** an attacker guessing `sender_private` can use any recipient’s server-held shard as a GCM decrypt oracle (`publicKey` is inside the shard). One correct guess unlocks all historical wraps to that recipient. Reuse across N messages does not weaken ECDLP materially but **amplifies post-compromise coverage**. Recipient-key guessing against that recipient’s own shards behaves the same as under ECDHE.

### Static ECDH for posts, ephemeral for shares only

- **Rejected:** two wrap modes for the same DEK distribution problem; share path still needs a wrapping party that may not be the original sender; inconsistent verification and documentation.

### No sender shard (sender keeps wrap material only locally)

- **Rejected for now:** breaks multi-device sender recovery unless a separate backup mechanism is added; current product requires sender-as-recipient for comments and sharing.

## References

- Code:
  - `src/crypto/manifestConstants.ts` - `MANIFEST_WRAP`
  - `src/crypto/manifestEncrypt.ts` - `generateManifestEphemeralAgreementKeyPair`, `derivePerRecipientKek`, `recipientsIncludingSender`, `encryptWithManifest`
  - `src/crypto/manifestDecrypt.ts` - `decryptDekFromManifestEntry`
  - `src/crypto/manifestShare.ts` - `buildManifestShare`
  - `src/crypto/manifestStorage.ts` - `splitManifestForStorage`, `assembleManifestForRecipient`
  - `src/crypto/manifestSign.ts` - `manifestSignableBodyForSigning` (shards not signed)
  - `src/services/db/storedMessageKeyManifest.ts` - per-recipient shard storage
  - `src/crypto/commentCrypto.ts` - comments reuse parent DEK after shard unwrap
- Related ADRs: [0001](./0001-use-architecture-decision-records.md)
