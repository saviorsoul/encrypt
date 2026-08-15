# RFC 0001: Message Encryption Protocol

| Field       | Value                     |
| ----------- | ------------------------- |
| **Status**  | Draft                     |
| **Version** | 0.1 (high-level overview) |
| **Date**    | 2026-08-15                |
| **Authors** | Artur Bańka               |

## Abstract

This document describes the end-to-end encryption protocol used by the Encrypt app for feed posts, one-to-one messages, shares, and comments. All cryptographic operations run on the client; servers (when used) store opaque ciphertext and per-recipient key-delivery records. This revision is intentionally high-level. Subsequent iterations will specify algorithms, wire formats, and normative procedures in full detail.

## 1. Introduction

### 1.1 Purpose

Encrypt provides private messaging where message plaintext never leaves the client in cleartext. The protocol uses **envelope encryption**: a random data-encryption key (DEK) encrypts the message body once, and each intended recipient receives an individually wrapped copy of that DEK. Recipients who successfully unwrap the DEK read the **same plaintext** — the protocol controls **who** can decrypt, not **what** each person sees.

### 1.2 Scope

This RFC covers:

- Identity keys and recipient addressing
- Feed and one-to-one message envelopes
- Share deliveries (granting access to an existing post)
- Comments on encrypted posts
- The split between public **core payload** and private **key-manifest shards**
- Client-side storage and optional server-backed delivery

Out of scope for this document (covered elsewhere):

- API request authentication ([ADR 0009](../adr/0009-api-authentication-with-server-minted-redis-nonces.md))
- Desktop deep-link transport ([ADR 0015](../adr/0015-browser-integration-via-encrypt-protocol.md))
- Private-key persistence and platform key handling ([ADR 0002](../adr/0002-in-memory-non-extractable-private-key-cache.md), [ADR 0016](../adr/0016-electron-safe-storage-private-key-persistence.md))

### 1.3 Conventions

The key words **MUST**, **MUST NOT**, **SHOULD**, **SHOULD NOT**, and **MAY** are to be interpreted as described in [RFC 2119](https://www.rfc-editor.org/rfc/rfc2119) when this document reaches normative status. In this draft they indicate intended requirements.

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

| Party                | Knows                                                       | Must never know                                              |
| -------------------- | ----------------------------------------------------------- | ------------------------------------------------------------ |
| **Sender client**    | Plaintext, own private key, all shards at compose time      | Other recipients' private keys                               |
| **Recipient client** | Plaintext after decrypt, own private key, own shard         | Other recipients' private keys                               |
| **Server** (if used) | Core payload, per-recipient shards (ACL-filtered), metadata | Plaintext, any private key, full `keyManifest` for all users |

The shipped desktop app is **local-first**: messages live in IndexedDB with no network dependency. The feed API is an optional backend that mirrors the same wire formats for development and future server-backed feeds.

## 4. Identity

Each user has a long-term **P-256 elliptic-curve key pair** used for two purposes:

1. **ECDH** — unwrap per-recipient DEK shards at decrypt time
2. **ECDSA** — sign message cores, shares, and comments

The public key is represented as a JSON Web Key (`kty: EC`, `crv: P-256`, `x`, `y`). The **keyId** is the RFC 7638 thumbprint of that public JWK and serves as the stable recipient address throughout the protocol.

Private keys remain on the client, imported as non-extractable Web Crypto keys.

## 5. Protocol Overview

### 5.1 Envelope encryption model

Every encrypted message follows the same structural pattern:

1. Generate a random **DEK** and encrypt the UTF-8 message body → `encryptedContent`
2. For each recipient (including the sender), derive a per-recipient **KEK** and wrap the DEK → shard in `keyManifest`
3. Sign the core fields with the sender's ECDSA key → `senderSignature`
4. Store or transmit **core** and **shards** according to the delivery model (§6)

All recipients decrypt the same `encryptedContent`. Shards differ only in how each party unwraps the shared DEK.

### 5.2 Key wrapping: ephemeral sender ECDHE

DEK shards are wrapped using **ephemeral sender ECDHE**, not static sender×recipient ECDH. For each message or share delivery:

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

This document does **not** claim full NIST SP 800-56A conformance today. Operational requirements such as explicit public-key validation, `FixedInfo` KDF binding, key confirmation, and mandated secret destruction are planned for a future revision (see alignment plan in `.cursor/plans/nist_sp_800_56a_alignment.plan.md`).

### 5.4 Cryptographic primitives (summary)

| Purpose        | Algorithm                              |
| -------------- | -------------------------------------- |
| Identity curve | P-256 (ECDH + ECDSA)                   |
| Message body   | AES-256-GCM                            |
| DEK wrapping   | AES-256-GCM with HKDF-derived KEK      |
| KEK derivation | HKDF-SHA-256                           |
| Signatures     | ECDSA P-256 / SHA-256                  |
| Wire encoding  | JSON; binary fields as standard Base64 |

Normative algorithm steps, constants, and parameter sizes will be specified in a future revision.

## 6. Message Types

### 6.1 Feed message / one-to-one message

The primary envelope. Used for feed posts and direct (one-to-one) threads.

**Core payload** (signed, same for all viewers):

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

| Artifact                  | Current version | Wrap identifier                   |
| ------------------------- | --------------- | --------------------------------- |
| Feed / one-to-one message | 9               | `ephemeral-sender-ecdhe-hkdf-aes` |
| Share delivery            | 1               | `manifest-share-v1`               |
| Comment                   | 1               | `message-bound-aes`               |

Implementations **MUST** reject envelopes with unknown `version` or `wrap` values.

## 10. Planned Normative Content (future revisions)

The following sections are reserved for detailed specification in subsequent RFC iterations:

1. **Normative algorithms** — step-by-step encrypt and decrypt procedures with exact Web Crypto calls
2. **NIST SP 800-56A alignment** — `FixedInfo` HKDF binding, public-key validation, key confirmation, assurances (see `.cursor/plans/nist_sp_800_56a_alignment.plan.md`)
3. **Wire format schemas** — JSON field definitions, types, and encoding rules
4. **Canonical signing** — exact field set and serialization order for signature verification
5. **Key generation and import** — JWK format, thumbprint computation, dual ECDH/ECDSA import
6. **Share and comment procedures** — parent resolution and access checks
7. **Interoperability test vectors** — known-answer tests for independent implementations
8. **IANA-style registries** — version numbers, wrap identifiers, HKDF info strings

Reference implementation: `packages/core/src/crypto/` in the Encrypt monorepo.

## 11. References

### 11.1 Internal

- [ADR 0003: Ephemeral sender ECDHE for key-manifest shards](../adr/0003-ephemeral-sender-ecdhe-for-key-manifest-shards.md)
- [ADR 0005: Feed share and comments — parent DEK model](../adr/0005-feed-share-and-comments-parent-dek-model.md)
- [ADR 0006: Known DEK does not recover recipient private key](../adr/0006-known-dek-does-not-recover-recipient-private-key.md)

### 11.2 External

- [RFC 5869](https://www.rfc-editor.org/rfc/rfc5869) — HMAC-based Extract-and-Expand Key Derivation Function (HKDF)
- [RFC 6090](https://www.rfc-editor.org/rfc/rfc6090) — Fundamental Elliptic Curve Cryptography Algorithms (ECDH)
- [RFC 7638](https://www.rfc-editor.org/rfc/rfc7638) — JSON Web Key (JWK) Thumbprint
- [NIST SP 800-38D](https://csrc.nist.gov/publications/detail/sp/800-38d/final) — Galois/Counter Mode (GCM)
- [NIST SP 800-56A Rev. 3](https://csrc.nist.gov/publications/detail/sp/800-56a/rev-3/final) — Recommendation for Pair-Wise Key Establishment Schemes Using Discrete Logarithm Cryptography (ECDH)

## Appendix A. High-Level Encrypt / Decrypt Flow

```
ENCRYPT (sender client)
═══════════════════════
  plaintext
      │
      ▼
  random DEK ──► AES-GCM ──► encryptedContent
      │
      ├──► ECDHE(ephemeral, recipient₁) ──► HKDF ──► KEK₁ ──► wrap DEK ──► shard₁
      ├──► ECDHE(ephemeral, recipient₂) ──► HKDF ──► KEK₂ ──► wrap DEK ──► shard₂
      └──► ... (sender included)
      │
      ▼
  ECDSA sign(core) ──► senderSignature
      │
      ▼
  { core payload, keyManifest }


DECRYPT (recipient client)
══════════════════════════
  core payload + own shard
      │
      ▼
  verify senderSignature
      │
      ▼
  ECDHE(own_private, ephemeralPublic) ──► HKDF ──► KEK ──► unwrap DEK
      │
      ▼
  AES-GCM(DEK, encryptedContent) ──► plaintext
```
