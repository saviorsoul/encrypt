# RFC 0001: Message Encryption Protocol

| Field       | Value                      |
| ----------- | -------------------------- |
| **Status**  | Draft                      |
| **Version** | 0.2 (normative algorithms) |
| **Date**    | 2026-08-15                 |
| **Authors** | Artur Bańka                |

## Abstract

This document describes the end-to-end encryption protocol used by the Encrypt app for multi-recipient messages (feed posts, direct threads, and similar deliveries), shares, and comments. All cryptographic operations run on the client; servers (when used) store opaque ciphertext and per-recipient key-delivery records. A direct one-to-one message uses the same envelope as a feed post addressed to a single other party (plus the sender). This revision specifies normative encrypt and decrypt algorithms with exact Web Crypto parameters. Wire-format schemas, full NIST alignment, and interoperability test vectors remain planned for subsequent iterations.

## 1. Introduction

### 1.1 Purpose

Encrypt provides private messaging where message plaintext never leaves the client in cleartext. The protocol uses **envelope encryption**: a random data-encryption key (DEK) encrypts the message body once, and each intended recipient receives an individually wrapped copy of that DEK. Recipients who successfully unwrap the DEK read the **same plaintext** — the protocol controls **who** can decrypt, not **what** each person sees.

### 1.2 Scope

This RFC covers:

- Identity keys and recipient addressing
- Multi-recipient message envelopes (feed posts, direct threads — same wire format; recipient count is a product choice, not a protocol variant)
- Share deliveries (granting access to an existing post)
- Comments on encrypted posts
- The split between public **core payload** and private **key-manifest shards**
- Client-side storage and optional server-backed delivery

Out of scope for this document (covered elsewhere):

- API request authentication ([ADR 0009](../adr/0009-api-authentication-with-server-minted-redis-nonces.md))
- Desktop deep-link transport ([ADR 0015](../adr/0015-browser-integration-via-encrypt-protocol.md))
- Private-key persistence and platform key handling ([ADR 0002](../adr/0002-in-memory-non-extractable-private-key-cache.md), [ADR 0016](../adr/0016-electron-safe-storage-private-key-persistence.md))

### 1.3 Conventions

The key words **MUST**, **MUST NOT**, **SHOULD**, **SHOULD NOT**, and **MAY** are to be interpreted as described in [RFC 2119](https://www.rfc-editor.org/rfc/rfc2119).

**Normative** sections (§10) state binding requirements: an independent implementation that follows them **MUST** interoperate with Encrypt clients. **Informative** sections (overview, trust model, security discussion) explain rationale and threat context but do not by themselves define wire behavior.

## 2. Terminology

| Term               | Definition                                                                                                                                               |
| ------------------ | -------------------------------------------------------------------------------------------------------------------------------------------------------- |
| **DEK**            | Data Encryption Key — a random AES-256 key used to encrypt the message body (`encryptedContent`). One DEK per post.                                      |
| **KEK**            | Key Encryption Key — a derived AES-256 key used to wrap the DEK for a single recipient.                                                                  |
| **Shard**          | A per-recipient record in `keyManifest` containing a wrapped DEK, salt, IV, and recipient public key.                                                    |
| **Core payload**   | The signed, publicly visible part of a message: sender identity, ephemeral agreement key, encrypted body, and signature. Does not include `keyManifest`. |
| **Key manifest**   | Map of recipient `keyId` → shard. Stored and delivered separately from the core payload.                                                                 |
| **keyId**          | Recipient identifier: RFC 7638 JWK thumbprint of the recipient's P-256 public key.                                                                       |
| **Delivery**       | A stored message or share row together with the recipient's shard, enabling decrypt for that party.                                                      |
| **Parent message** | The original feed post that a share or comment refers to.                                                                                                |

## 3. Trust Model

```
┌──────────────┐         ┌──────────────┐         ┌──────────────┐
│   Client A   │         │   Server     │         │   Client B   │
│              │         │  (optional)  │         │              │
│ • generate   │         │ • store      │         │ • decrypt    │
│   keys       │         │   ciphertext │         │   locally    │
│ • encrypt    │ ──────► │ • ACL-scoped │ ──────► │ • verify     │
│ • sign       │         │   shards     │         │   signatures │
│ • hold       │         │ • never sees │         │ • hold       │
│   private    │         │   plaintext  │         │   private    │
│   keys       │         │   or private │         │   keys       │
│              │         │   keys       │         │              │
└──────────────┘         └──────────────┘         └──────────────┘
```

| Party                | Knows                                                                                     | Must never know                |
| -------------------- | ----------------------------------------------------------------------------------------- | ------------------------------ |
| **Sender client**    | Plaintext, own private key, all shards at compose time                                    | Other recipients' private keys |
| **Recipient client** | Plaintext after decrypt, own private key, own shard                                       | Other recipients' private keys |
| **Server** (if used) | Core payload, full `keyManifest` (all shards at rest; ACL-filtered on delivery), metadata | Plaintext, any private key     |

## 4. Identity

Each user has one long-term **P-256 elliptic-curve key pair** (a single private JWK with coordinates `x`, `y`, `d`). The same key material is imported into Web Crypto twice with different algorithms:

1. **ECDH** — public key for identity (`senderPublicJwk`) and recipient-side shard unwrap; private key used only at decrypt
2. **ECDSA** — private key for signing message cores, shares, and comments; public key used only at verify

The public coordinates are represented as a JSON Web Key (`kty: EC`, `crv: P-256`, `x`, `y`). The **keyId** is the RFC 7638 thumbprint of that public JWK and serves as the stable recipient address throughout the protocol.

Private keys remain on the client, imported as non-extractable Web Crypto keys (§10.7).

## 5. Protocol Overview

### 5.1 Envelope encryption model

Every encrypted message follows the same structural pattern, whether addressed to one other party or many:

1. Generate a random **DEK** and encrypt the UTF-8 message body once → `encryptedContent`
2. For **each** intended recipient (including the sender), derive a per-recipient **KEK** and wrap the same DEK → shard in `keyManifest`
3. Sign the core fields with the sender's ECDSA key → `senderSignature`
4. Store or transmit **core** and **shards** according to the delivery model (§6)

All recipients decrypt the same `encryptedContent`. Shards differ only in how each party unwraps the shared DEK. A one-to-one thread is the case `|recipients| = 1` besides the sender (two shards total when the sender is included).

### 5.2 Key wrapping: ephemeral sender ECDHE

DEK shards are wrapped with KEK using **ephemeral sender ECDHE**, not static sender×recipient ECDH. For each message or share delivery:

1. The sender generates a one-time ephemeral P-256 key pair
2. For each recipient: `sharedSecret = ECDH(ephemeral_private, recipient_public)`
3. `KEK = HKDF-SHA-256(sharedSecret, per-recipient salt, info)`
4. `shard.encryptedDek = AES-256-GCM(KEK, DEK)`
5. The ephemeral private key is discarded; only `ephemeralPublicKey` appears in the core payload

This design ensures that a compromised sender long-term private key alone cannot unwrap another user's server-stored shard. Unwrapping requires the recipient's private key (or brute-forcing the discarded ephemeral key). See [ADR 0003](../adr/0003-ephemeral-sender-ecdhe-for-key-manifest-shards.md).

### 5.3 Standards alignment

The DEK-wrap key agreement is **inspired by** [NIST SP 800-56A Rev. 3](https://csrc.nist.gov/publications/detail/sp/800-56a/rev-3/final) scheme **C(1e, 1s) One-Pass Diffie-Hellman** (§6.2.2.2): the sender contributes an ephemeral key pair, each recipient contributes a static key pair, and both parties derive the same shared secret Z via ECDH on P-256.

| NIST role               | Protocol role                               |
| ----------------------- | ------------------------------------------- |
| Party U (ephemeral)     | Sender's per-message `ephemeralKeyPair`     |
| Party V (static)        | Each recipient's long-term P-256 key        |
| Shared secret Z         | `ECDH(ephemeral_private, recipient_public)` |
| Derived keying material | HKDF-SHA-256 → AES-GCM KEK → wrapped DEK    |

The implementation uses the Web Cryptography API, which performs ECDH per [RFC 6090](https://www.rfc-editor.org/rfc/rfc6090) §4. For P-256 the cofactor is 1, so this is equivalent to NIST's ECC CDH primitive (§5.7.1.2).

This document does **not** claim full NIST SP 800-56A conformance today. Operational requirements such as explicit public-key validation, `FixedInfo` KDF binding, key confirmation, and mandated secret destruction are planned for a future revision.

### 5.4 Cryptographic primitives (summary)

| Purpose        | Algorithm                              |
| -------------- | -------------------------------------- |
| Identity curve | P-256 (ECDH + ECDSA)                   |
| Message body   | AES-256-GCM                            |
| DEK wrapping   | AES-256-GCM with HKDF-derived KEK      |
| KEK derivation | HKDF-SHA-256                           |
| Signatures     | ECDSA P-256 / SHA-256                  |
| Wire encoding  | JSON; binary fields as standard Base64 |

Normative algorithm steps, constants, and parameter sizes are specified in §10.

## 6. Message Types

### 6.1 Message envelope (multi-recipient)

The primary envelope. One ciphertext, one `keyManifest` entry per intended recipient. Used for feed posts, direct threads, and any other delivery where the sender chooses who may decrypt.

Recipient count is not part of the wire format: a direct message to one other user is this envelope with a single external recipient (the sender is still included; see below). No separate one-to-one algorithm or wrap identifier exists.

**Core payload** (signed, identical for every viewer):

- Protocol version and wrap identifier
- Sender public JWK and ephemeral public JWK
- `encryptedContent` (IV + ciphertext)
- `senderSignature`

**Key manifest** (per-recipient, delivered separately):

- Map of `keyId` → `{ salt, iv, encryptedDek, publicKey }`

The sender is always included as a recipient so they can decrypt their own posts, add comments, and create shares.

**Wrap identifier:** `ephemeral-sender-ecdhe-hkdf-aes`

### 6.2 Share delivery

Grants additional recipients access to an **existing** post without re-encrypting the body.

1. Sharer unwraps the parent DEK from a delivery shard they already hold
2. A fresh ephemeral ECDHE wrap produces a new `keyManifest` for the selected recipients (same raw DEK)
3. A signed **share core** references `parentMessageId` and carries the new `ephemeralPublicKey`
4. Recipients decrypt the parent `encryptedContent` using their shard on the share delivery

The parent post's ciphertext and signature are never modified.

**Wrap identifier:** `manifest-share-v1`

See [ADR 0005](../adr/0005-feed-share-and-comments-parent-dek-model.md).

### 6.3 Comment

Encrypted discussion text bound to a parent post.

1. Author unwraps the parent DEK via their shard
2. `commentKey = HKDF(parent DEK, random salt, info)`
3. Comment body encrypted with AES-256-GCM under `commentKey`
4. Signed comment payload includes `messageId` (parent local id), salt, and `encryptedContent`

Comments do not add recipients to the parent `keyManifest` and do not run a second ECDHE round. Anyone with parent DEK access can decrypt all comments on that post.

**Wrap identifier:** `message-bound-aes`

## 7. Storage Model

### 7.1 Core / shard split

Implementations **MUST** treat the core payload and key-manifest shards as separable units:

```
Message (logical)
├── Core payload     → visible on feed / stored in messages.payload
└── Key manifest     → one shard per (messageId, recipientKeyId)
    ├── shard[Alice]
    ├── shard[Bob]
    └── shard[Sender]
```

This split enables ACL-scoped shard delivery: a server returns only the requesting user's shard while the core payload is public to all feed subscribers.

It also keeps both database and network costs bounded per user. Shards are keyed by `(messageId, recipientKeyId)`, so a client or inbox query fetches a single row in O(1). The same scope applies on the wire: each request carries one shard, not the entire manifest.

### 7.2 Client storage (IndexedDB)

| Store                  | Holds                                               |
| ---------------------- | --------------------------------------------------- |
| `messages`             | Core payload; `parentMessageId` for share rows      |
| `message_key_manifest` | Per-recipient shards keyed by `(messageId, keyId)`  |
| `comments`             | Signed comment payloads keyed by parent `messageId` |

### 7.3 Server storage (optional)

When a backend is used, the server stores the core payload and one shard row per intended recipient. Inbox queries return only the authenticated user's shard. The server performs no cryptographic operations on message content.

## 8. Security Considerations

### 8.1 What the protocol provides

- **End-to-end confidentiality** of message plaintext against the server and unauthorized recipients
- **Sender authenticity** via ECDSA signatures on core payloads, shares, and comments
- **Recipient binding** — each shard is addressed to one `keyId`; wrong private key causes GCM failure
- **Shard isolation** — ephemeral sender ECDHE prevents a leaked sender key from opening other users' server-stored shards

### 8.2 Known limitations

- **Unsigned shards.** `keyManifest` entries are not covered by `senderSignature`. Shard integrity relies on storage-layer trust and ACL enforcement. A malicious server could substitute shards (recipients would fail GCM decrypt unless the attacker also knows the DEK).
- **No forward secrecy for stored posts.** Once encrypted and stored, compromise of a recipient's long-term private key exposes their shard and thus the DEK for all messages they can access.

### 8.3 Sender-as-recipient

The sender's own shard is stored alongside other recipients'. This means an attacker with the sender's private key and the sender's shard can decrypt the sender's own posts — by design, to support self-decrypt, comment, and share flows. ECDHE does not add extra protection for the sender's copy of their own content.

## 9. Protocol Versions

| Artifact         | Current version | Wrap identifier                   |
| ---------------- | --------------- | --------------------------------- |
| Message envelope | 9               | `ephemeral-sender-ecdhe-hkdf-aes` |
| Share delivery   | 1               | `manifest-share-v1`               |
| Comment          | 1               | `message-bound-aes`               |

Implementations **MUST** reject envelopes with unknown `version` or `wrap` values.

## 10. Normative Algorithms

This section is **normative**. Steps below use the [Web Cryptography API](https://www.w3.org/TR/WebCryptoAPI/) (`crypto.subtle`). Binary fields on the wire are standard Base64 (RFC 4648); `keyId` values are RFC 7638 JWK thumbprints encoded as base64url without padding.

### 10.1 Cryptographic constants

| Parameter                  | Value                                             |
| -------------------------- | ------------------------------------------------- |
| Identity / agreement curve | P-256 (`namedCurve: 'P-256'`)                     |
| ECDH derived secret length | 256 bits                                          |
| DEK / KEK algorithm        | AES-GCM, 256-bit key                              |
| AES-GCM IV length          | 12 bytes (96 bits), from `crypto.getRandomValues` |
| HKDF hash                  | SHA-256                                           |
| HKDF salt length           | 32 bytes                                          |
| Manifest HKDF `info`       | UTF-8 octets of `manifest-v3:key-wrap`            |
| Comment HKDF `info`        | UTF-8 octets of `comment-v1:content`              |
| Message envelope `version` | `9`                                               |
| Message envelope `wrap`    | `ephemeral-sender-ecdhe-hkdf-aes`                 |
| Share delivery `version`   | `1`                                               |
| Share delivery `wrap`      | `manifest-share-v1`                               |
| Comment `version`          | `1`                                               |
| Comment `wrap`             | `message-bound-aes`                               |

Implementations **MUST** reject envelopes whose `version` or `wrap` do not match the expected pair for that message type (§9).

### 10.2 Shared primitives

#### 10.2.1 ECDH shared secret

Given a local ECDH private key `localPrivate` and a remote P-256 public key `remotePublic`:

```
sharedSecret = crypto.subtle.deriveBits(
  { name: 'ECDH', public: remotePublic },
  localPrivate,
  256
)
```

On encrypt/wrap the local key is the sender's (or sharer's) **ephemeral** private key and the remote key is each recipient's long-term public key. On decrypt/unwrap the local key is the recipient's long-term private key and the remote key is `ephemeralPublicKey` from the core payload.

#### 10.2.2 Import HKDF key material

Given `sharedSecret` from §10.2.1 (or, for comments, the raw parent DEK):

```
hkdfKeyMaterial = crypto.subtle.importKey('raw', sharedSecret, 'HKDF', false, ['deriveKey'])
```

This step does not use a salt or `info` string; it prepares the shared secret for HKDF expand in §10.2.3.

#### 10.2.3 HKDF expand → AES-GCM KEK

Given `hkdfKeyMaterial` from §10.2.2 and a 32-byte salt `S`:

```
KEK = crypto.subtle.deriveKey(
  { name: 'HKDF', hash: 'SHA-256', salt: S, info: INFO },
  hkdfKeyMaterial,
  { name: 'AES-GCM', length: 256 },
  false,
  keyUsages   // ['encrypt'] on wrap; ['decrypt'] on unwrap
)
```

Use `INFO = manifest-v3:key-wrap` for DEK shards. Use `INFO = comment-v1:content` for comment body keys. On encrypt, `S` **MUST** be freshly random; on decrypt, `S` **MUST** be the Base64-decoded `salt` from the shard or comment payload.

#### 10.2.4 AES-GCM encrypt / decrypt

**DEK as `CryptoKey` vs `rawDek` (in-memory only).** `generateKey` yields a `DEK` handle (`CryptoKey`) for AES-GCM. To wrap the same secret for each recipient, the implementation reads the 32-byte AES-256 key material in memory:

```
rawDek = crypto.subtle.exportKey('raw', DEK)   // 32 bytes; client memory only
```

`exportKey` here is the Web Cryptography API call — **not** publication in the JSON payload. **`rawDek` MUST NOT appear in cleartext on the wire.** Recipients see only `encryptedDek` in their shard (the DEK AES-GCM–encrypted under their KEK). After unwrap, the recipient runs `crypto.subtle.importKey('raw', rawDek, …)` to obtain a `DEK` handle for body decryption.

**Message body** (one DEK per post):

```
plaintextIv = random(12)
ciphertext = crypto.subtle.encrypt({ name: 'AES-GCM', iv: plaintextIv }, DEK, UTF8(plaintext))
```

**Wrapped DEK** (per recipient shard; `KEK` from §10.2.3):

```
dekIv = random(12)
encryptedDek = crypto.subtle.encrypt({ name: 'AES-GCM', iv: dekIv }, KEK, rawDek)
```

Decrypt is the inverse `crypto.subtle.decrypt` call with the same IV and key. GCM authentication failure **MUST** be treated as decrypt failure (wrong key, wrong shard, or tampering).

#### 10.2.5 Canonical signing

Signable bodies **MUST** be serialized as UTF-8 JSON with a fixed property order (insertion order below), then signed with ECDSA P-256 / SHA-256:

```
signature = crypto.subtle.sign({ name: 'ECDSA', hash: 'SHA-256' }, signingPrivateKey, UTF8(JSON.stringify(canonicalObject)))
senderSignature = Base64(signature)
```

Verification imports the sender's public JWK for ECDSA verify and calls `crypto.subtle.verify` with the same canonical bytes. The `keyManifest` and signature fields themselves are **not** part of the signed byte string.

### 10.3 Message envelope — encrypt

**Inputs:**

- **`plaintext`** — UTF-8 message body to encrypt.
- **Sender long-term P-256 key pair** (one private JWK; dual Web Crypto import per §10.7):
  - **Public** — imported as ECDH for `senderPublicJwk` and sender-as-recipient in `recipients[]`.
  - **Private** — imported as ECDSA for signing (step 7 only). The long-term ECDH private key is **not** used when wrapping shards (that uses the ephemeral agreement key from step 2).
- **`recipients[]`** — intended recipients, one or many. Each entry provides:
  - **`keyId`** — RFC 7638 thumbprint of the recipient's public JWK.
  - **`publicKey`** — recipient's long-term P-256 key, imported as ECDH public.

The protocol is identical whether `recipients[]` has one external party or many; only shard count changes.

**Procedure:**

1. **DEK and message body**
   - Generate AES-GCM-256 `DEK` (`CryptoKey`).
   - Read 32-byte key material in client memory: `rawDek = crypto.subtle.exportKey('raw', DEK)` — used in step 5 only; **never** placed in cleartext in the payload.
   - Encrypt UTF-8 `plaintext` with the `DEK` handle (§10.2.4) and random **IV** → AES-GCM **ciphertext**.
   - **Output:** `encryptedContent = { iv, ciphertext }` — Base64-encode the IV and ciphertext for the wire.

2. **ECDHE**
   - Generate an extractable ephemeral P-256 ECDH key pair (`generateKey`, usages `deriveBits`, `deriveKey`) — one agreement key for this message only.
   - Serialize the public half to `ephemeralPublicKey` (minimal JWK: `kty`, `crv`, `x`, `y`). It is included in the core payload; the private half is **not** sent.
   - Build `recipients[]`. The sender **MUST** be included (`keyId` = thumbprint of `senderPublicJwk`).
   - For each recipient `R`: `sharedSecret = ECDH(ephemeralPrivate, R.publicKey)` (§10.2.1).
   - The ephemeral private key **MUST** be discarded after step 5; it **MUST NOT** be stored or transmitted.

3. **Import HKDF key material**
   - For each recipient: import that recipient's `sharedSecret` as `hkdfKeyMaterial` (§10.2.2).

4. **Derive per-recipient KEK**
   - For each recipient: draw random 32-byte salt `S`.
   - Derive `KEK` with `INFO = manifest-v3:key-wrap` (§10.2.3).

5. **Wrap DEK per recipient**
   - For each recipient: AES-GCM-encrypt the in-memory `rawDek` bytes with that recipient's `KEK` (§10.2.4). Cleartext `rawDek` stays in client memory; the wire carries only `encryptedDek`.
   - Store one shard per recipient in `keyManifest`:

     | Shard field    | Source                  |
     | -------------- | ----------------------- |
     | `keyId`        | Recipient's `keyId`     |
     | `publicKey`    | Recipient's public JWK  |
     | `salt`         | Base64(`S`) from step 4 |
     | `iv`           | Base64(DEK-wrap IV)     |
     | `encryptedDek` | Base64(wrapped DEK)     |

6. **Core assembly**
   - Build the signable body in this property order (no `keyManifest`, no signature yet):

     ```json
     {
       "version": 9,
       "wrap": "ephemeral-sender-ecdhe-hkdf-aes",
       "senderPublicJwk": { "...": "..." },
       "ephemeralPublicKey": { "...": "..." },
       "encryptedContent": { "iv": "...", "ciphertext": "..." }
     }
     ```

7. **Sign and output**
   - ECDSA-sign the canonical body from step 6 (§10.2.5) → `senderSignature`.
   - Emit `{ senderSignature, ...signableBody, keyManifest }`.
   - Implementations **MAY** split core and shards for storage (§7); the cryptographic content is unchanged.

### 10.4 Message envelope — decrypt

**Inputs:**

- **Core payload** — signed manifest core, with or without inline `keyManifest`.
- **Requesting user's shard** — `keyManifest[recipientKeyId]` for the party performing decrypt.
- **Requesting user's long-term P-256 key pair** (dual import per §10.7):
  - **`keyId`** — RFC 7638 thumbprint of their public JWK; must match the shard's `keyId`.
  - **ECDH private key** — unwrap the DEK from the shard (steps 3–6).
  - **ECDSA verify public key** — derived from `senderPublicJwk` in the core; verify `senderSignature` (step 1).

Each authorized recipient runs the same procedure against their own shard and recovers the same plaintext.

**Procedure:**

1. **Verify signature**
   - Parse JSON; reject if `version ≠ 9` or `wrap ≠ ephemeral-sender-ecdhe-hkdf-aes`.
   - Reconstruct the signable body (§10.3 step 6 fields only).
   - Verify `senderSignature` against `senderPublicJwk` (§10.2.5). Abort on failure.

2. **Extract manifest fields**
   - Read from the payload: `ephemeralPublicKey`, `encryptedContent`.
   - Load `entry = keyManifest[recipientKeyId]`. Abort if missing.

3. **ECDHE**
   - Import `ephemeralPublicKey` as ECDH public (`importKey`, `ECDH`, `P-256`).
   - `sharedSecret = ECDH(recipientPrivate, ephemeralPublic)` (§10.2.1).

4. **Import HKDF key material**
   - Import `sharedSecret` as `hkdfKeyMaterial` (§10.2.2).

5. **Derive KEK**
   - `S = Base64Decode(entry.salt)`.
   - Derive `KEK` with `INFO = manifest-v3:key-wrap` (§10.2.3, usages `['decrypt']`).

6. **Unwrap DEK**
   - AES-GCM-decrypt `entry.encryptedDek` with `KEK` (§10.2.4) → 32-byte `rawDek` in client memory (still not sent on the wire).

7. **Decrypt body**
   - `DEK = crypto.subtle.importKey('raw', rawDek, { name: 'AES-GCM', length: 256 }, …)` — re-create the `CryptoKey` handle from the unwrapped bytes.
   - Decrypt `encryptedContent` with `DEK` (§10.2.4) → UTF-8 plaintext.

### 10.5 Share delivery — encrypt and decrypt

Share deliveries reuse §10.2–§10.3 wrapping for the **same** parent `rawDek`; the parent message body is not re-encrypted.

**Encrypt (sharer):**

1. Recover `rawDek` from a parent or prior share delivery shard the sharer already holds (§10.4).
2. Verify the parent core signature.
3. Generate a **new** ephemeral agreement key pair (§10.3 step 2).
4. Build shards for new recipients (+ sharer) with §10.3 steps 3–5.
5. Sign a share core (not the parent body) with this canonical object:

   ```
   {
     version: 1,
     wrap: 'manifest-share-v1',
     parentMessageId,
     sharerPublicJwk,
     ephemeralPublicKey
   }
   ```

   → `sharerSignature`. Output `{ sharerSignature, ... }` plus separate `keyManifest`.

**Decrypt (new recipient):**

1. Verify share core signature and parent core signature.
2. Confirm `share.parentMessageId` matches the intended parent.
3. Unwrap DEK from the **share** shard using the share's `ephemeralPublicKey` (§10.4 steps 3–6).
4. Decrypt the **parent** `encryptedContent` with that DEK (§10.4 step 7).

### 10.6 Comment — encrypt and decrypt

Comments bind to a parent post by `messageId`. They do **not** add `keyManifest` entries.

**Encrypt (author with parent access):**

1. Recover parent `rawDek` (§10.5 parent access / §10.4).
2. `S = random(32)`; import parent `rawDek` as `hkdfKeyMaterial` (§10.2.2); derive `commentKey` with `INFO = comment-v1:content` (§10.2.3).
3. Encrypt comment UTF-8 text with `commentKey` (§10.2.4) → `encryptedContent`.
4. Sign canonical body:

   ```
   {
     version: 1,
     wrap: 'message-bound-aes',
     messageId,
     senderPublicJwk,
     salt: Base64(S),
     encryptedContent: { iv, ciphertext }
   }
   ```

**Decrypt (any party with parent DEK):**

1. Verify comment signature; confirm `messageId` matches the parent.
2. Recover parent `rawDek`.
3. Import parent `rawDek` as `hkdfKeyMaterial` (§10.2.2); derive `commentKey` with `S = Base64Decode(payload.salt)` and `INFO = comment-v1:content` (§10.2.3).
4. Decrypt `encryptedContent` with `commentKey` (§10.2.4) → comment plaintext.

### 10.7 Key import (minimal)

Long-term keys use **one** P-256 key pair per user. The same private JWK **MUST** be imported twice — once for ECDH (`deriveKey`, `deriveBits`) and once for ECDSA (`sign`) — because Web Crypto binds algorithm and usages at import time. Strip `key_ops` from JWKs before import so the caller-supplied usages are authoritative. Private imports **MUST** be non-extractable.

| Role                                                           | Web Crypto import                                                                                  |
| -------------------------------------------------------------- | -------------------------------------------------------------------------------------------------- |
| Long-term ECDH private (decrypt / unwrap)                      | `{ name: 'ECDH', namedCurve: 'P-256' }`, usages `['deriveKey', 'deriveBits']`, extractable `false` |
| Long-term ECDH public (encrypt identity, recipient addressing) | Same algorithm, extractable `true`, usages `[]`                                                    |
| Long-term ECDSA signing private (encrypt / sign)               | `{ name: 'ECDSA', namedCurve: 'P-256' }`, usages `['sign']`, extractable `false`                   |
| Long-term ECDSA verify public (decrypt / verify)               | `{ name: 'ECDSA', namedCurve: 'P-256' }`, usages `['verify']`, extractable `true`                  |

## 11. Planned Normative Content (future revisions)

The following remain for subsequent RFC iterations:

1. **NIST SP 800-56A alignment** — `FixedInfo` HKDF binding, public-key validation, key confirmation, assurances
2. **Wire format schemas** — JSON field definitions, types, and encoding rules
3. **Interoperability test vectors** — known-answer tests for independent implementations
4. **IANA-style registries** — version numbers, wrap identifiers, HKDF info strings

## 12. References

### 12.1 Internal

- [ADR 0003: Ephemeral sender ECDHE for key-manifest shards](../adr/0003-ephemeral-sender-ecdhe-for-key-manifest-shards.md)
- [ADR 0005: Feed share and comments — parent DEK model](../adr/0005-feed-share-and-comments-parent-dek-model.md)
- [ADR 0006: Known DEK does not recover recipient private key](../adr/0006-known-dek-does-not-recover-recipient-private-key.md)

### 12.2 External

- [RFC 5869](https://www.rfc-editor.org/rfc/rfc5869) — HMAC-based Extract-and-Expand Key Derivation Function (HKDF)
- [RFC 6090](https://www.rfc-editor.org/rfc/rfc6090) — Fundamental Elliptic Curve Cryptography Algorithms (ECDH)
- [RFC 7638](https://www.rfc-editor.org/rfc/rfc7638) — JSON Web Key (JWK) Thumbprint
- [NIST SP 800-38D](https://csrc.nist.gov/publications/detail/sp/800-38d/final) — Galois/Counter Mode (GCM)
- [NIST SP 800-56A Rev. 3](https://csrc.nist.gov/publications/detail/sp/800-56a/rev-3/final) — Recommendation for Pair-Wise Key Establishment Schemes Using Discrete Logarithm Cryptography (ECDH)

## Appendix A. High-Level Encrypt / Decrypt Flow

```
ENCRYPT (sender client) — see §10.3
═══════════════════════════════════════════════════
  Step 1   plaintext ──► random DEK ──► AES-GCM ──► encryptedContent
  Step 2   ephemeral ECDH key pair
           ├──► ECDHE(ephemeral, recipient₁) ──► sharedSecret₁
           ├──► ECDHE(ephemeral, recipient₂) ──► sharedSecret₂
           └──► ... (sender included)
  Step 3   import each sharedSecret as HKDF key material
  Step 4   HKDF expand (+ random salt) ──► KEK₁, KEK₂, ...
  Step 5   AES-GCM(KEK, rawDek) ──► shard₁, shard₂, ...
  Step 6   assemble core payload (sender + ephemeral public keys, encryptedContent, keyManifest)
  Step 7   ECDSA sign(core) ──► senderSignature


DECRYPT (recipient client) — see §10.4
═══════════════════════════════════════════════════════
  Step 1   verify senderSignature
  Step 2   extract ephemeralPublicKey, encryptedContent, own shard
  Step 3   ECDHE(recipientPrivate, ephemeralPublic) ──► sharedSecret
  Step 4   import sharedSecret as HKDF key material
  Step 5   HKDF expand (salt from shard) ──► KEK
  Step 6   AES-GCM(KEK, encryptedDek) ──► rawDek
  Step 7   AES-GCM(DEK, encryptedContent) ──► plaintext
```
