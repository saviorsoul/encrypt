# 0006. Known DEK and message material do not recover a recipient’s private key

- **Status:** Accepted
- **Date:** 2026-06-26

## Context

Feed posts, share deliveries, and comments (ADR 0005) intentionally give every thread member the **same message DEK** and therefore the **same plaintext**. A co-recipient, sharer, or anyone who intercepts a successful decrypt therefore often holds:

- the **raw DEK** (32-byte AES key)
- the **decrypted message body**
- their own or another user’s **shard** (`salt`, `iv`, `encryptedDek`, `publicKey`)
- **public wire material** from the core payload (`senderPublicJwk`, `ephemeralPublicKey`, `encryptedContent`)

It is reasonable to ask whether this bundle lets a bad actor **derive or guess the long-term private key** of another recipient (e.g. Bob’s `.jwk` private key). If it did, thread membership would imply impersonation risk, not only read access.

A related question comes from the **server threat model**: a malicious or breached backend may accumulate **many** cores, shards, and — after compromising any user — large volumes of **decrypted posts and DEKs**. It is reasonable to ask whether that history **reduces the work** needed to break confidentiality for users whose keys are still safe.

This ADR records why private-key recovery and cross-user decrypt **do not** become easier with message volume, and why that is separate from **coverage** after a key is already lost.

### How this ADR relates to 0003 and 0005

Three records cover adjacent but distinct concerns:

| ADR                                                              | Primary question                                                                                                                                                    |
| ---------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| [0003](./0003-ephemeral-sender-ecdhe-for-key-manifest-shards.md) | **How** should each shard’s KEK be derived (ECDHE vs static ECDH), and **which long-term key** must an attacker guess to open **another user’s server-held shard**? |
| [0005](./0005-feed-share-and-comments-parent-dek-model.md)       | **Who** legitimately shares one message DEK (original recipients, sharers, commenters) and what does thread membership reveal?                                      |
| **0006 (this record)**                                           | Given that thread members **already hold the DEK**, can they recover **another member’s long-term private key** from message artifacts?                             |

ADR 0003’s guess-and-verify analysis assumes the attacker’s goal is to **recover the DEK from a shard**. ADR 0005 makes it normal for co-recipients to **already have** that DEK. That reversal raises a new, intuitive question this ADR answers explicitly.

## Decision

**Knowing the DEK, decrypted plaintext, a recipient’s `encryptedDek` shard, and the public keys on the wire does not provide a practical path to recover that recipient’s long-term ECDH private key.**

The wrap chain is one-way at each step. The only practical offline attack against Bob’s shard remains **guess-and-verify** over candidate private keys (~128-bit ECDLP work for P-256), unchanged in difficulty when the DEK is already known.

### What “public key of the message” means here

| Field                                        | Role                                                     | Used to unwrap Bob’s shard?                                      |
| -------------------------------------------- | -------------------------------------------------------- | ---------------------------------------------------------------- |
| `publicKey` inside Bob’s shard               | Bob’s long-term **ECDH** public key                      | Identity only — attacker already has this                        |
| `ephemeralPublicKey` in core / share payload | One-time **ECDH** agreement public key for this delivery | Yes — Bob unwraps with `Bob_private × ephemeralPublicKey`        |
| `senderPublicJwk` / `sharerPublicJwk`        | Long-term **ECDSA** signing key                          | **No** — signing is separate from the ECDHE wrap path (ADR 0003) |

### Cryptographic chain (Bob’s shard)

```
ephemeral_private × Bob_public  →  shared secret
HKDF(shared secret, shard.salt) →  KEK
AES-GCM(KEK, DEK)               →  shard.encryptedDek

Bob decrypts with Bob_private × ephemeralPublicKey (same shared secret).
```

The attacker who already holds the **DEK** knows the output of the last step. They still do not know `ephemeral_private` (discarded after wrap) or `Bob_private`.

### Why each plausible attack path fails

#### 1. Invert AES-GCM from known DEK + `encryptedDek`

Given plaintext `DEK`, ciphertext `encryptedDek`, and `iv`, recovering `KEK` is a **256-bit brute-force** problem. There is no efficient known-plaintext attack on AES-GCM that reduces this below exhaustive search. This is strictly harder than guessing `Bob_private`.

#### 2. Invert HKDF from KEK to shared secret

Even if an attacker somehow obtained `KEK`, HKDF is a one-way derivation. They cannot recover the ECDH shared secret from `KEK` and `salt` without brute force over the shared secret space.

#### 3. Solve for `Bob_private` from shared secret + `ephemeralPublicKey`

If the shared secret were known, finding `Bob_private` such that  
`ECDH(Bob_private, ephemeralPublicKey) = shared_secret`  
is the **elliptic-curve discrete logarithm problem (ECDLP)** on P-256 — roughly **128-bit** classical security. No shortcut is introduced by also knowing the DEK or message plaintext.

#### 4. Guess-and-verify using known DEK as confirmation

The practical offline attack (also described in ADR 0003) is:

```text
for candidate Bob_private:
    shared = ECDH(candidate, ephemeralPublicKey)
    kek = HKDF(shared, shard.salt)
    if AES-GCM-decrypt(shard.encryptedDek, kek, shard.iv) == known_DEK:
        candidate is correct
```

Knowing the DEK in advance makes the check slightly more explicit (compare bytes instead of relying on GCM tag alone) but **does not reduce the search space** for `Bob_private`. Each wrong candidate still fails with overwhelming probability; the loop still requires ~2^128 trials in expectation for a uniform P-256 private key.

#### 5. Use decrypted message + `encryptedContent`

`encryptedContent` is `AES-GCM(DEK, plaintext)`. With **both** `DEK` and `plaintext` already known, the body ciphertext adds **no new constraint** on `Bob_private`. It only confirms what the attacker already learned from the DEK.

#### 6. Use `senderPublicJwk` on the wrap path

Under ephemeral sender ECDHE (ADR 0003), shards are **not** wrapped with `ECDH(sender_private, Bob_public)`. The sender’s long-term private key is not part of the equation that produced Bob’s `encryptedDek`. Knowing the sender’s public signing key does not help invert Bob’s shard.

### Many messages: does volume reduce the work to break confidentiality?

A **malicious or fully breached server** may hold a large history: every core payload, every per-recipient shard, and — if it has ever learned keys or plaintext — a growing pile of **decrypted posts and DEKs**. Each feed post or share delivery uses a **fresh** `ephemeralPublicKey` (and discarded `ephemeral_private`), a **random message DEK**, and per-shard salts and IVs. Comments on a post reuse the parent DEK but derive **independent** comment keys via `HKDF(DEK, salt)` (ADR 0005).

It is important to separate two different questions:

| Question                                                                     | Does more messages help the attacker?                                               |
| ---------------------------------------------------------------------------- | ----------------------------------------------------------------------------------- |
| **A. Work to recover a specific long-term private key** (e.g. `Bob_private`) | **No** — still ~128-bit ECDLP per key; message count does not meaningfully lower it |
| **B. Value after a key is already compromised**                              | **Yes** — more ciphertext unlocked per broken key (coverage / blast radius)         |

This app’s design limits **B** for cross-user shard opens (ECDHE, ADR 0003). It does **not** let bulk history reduce **A**.

#### What the server can hold

For each feed post or share delivery `i`, the server typically stores:

| Per delivery `i`                                                                       | Independent of other deliveries?             |
| -------------------------------------------------------------------------------------- | -------------------------------------------- |
| Random **message DEK** `_i`                                                            | Yes — new 256-bit key per post body          |
| Fresh **`ephemeralPublicKey`** `_i` (and wrap used discarded `ephemeral_private` `_i`) | Yes — new agreement key per delivery         |
| Per-recipient **shard** (`salt`, `iv`, `encryptedDek`)                                 | Yes — new salt/iv per recipient per delivery |
| **`encryptedContent`** `_i`                                                            | Body ciphertext under DEK `_i`               |

If the server also has **decrypted** material for some subset, that usually means it **already broke or coerced some user key**, or a client sent plaintext — not that algebra on N plaintexts unlocked a new key.

#### Attack path 1 — Server has shards only (no private keys)

The offline attack remains guess-and-verify (ADR 0003):

```text
for candidate Bob_private:
    for each delivery i where a Bob shard exists:
        shared_i = ECDH(candidate, ephemeralPublicKey_i)
        kek_i = HKDF(shared_i, salt_i)
        if AES-GCM-decrypt(encryptedDek_i, kek_i, iv_i) fails:
            reject candidate
    accept candidate  // all shards for this delivery set consistent
```

**Effect of large N (many Bob shards across posts):**

- **Search space** for `Bob_private` is unchanged (~2^128 for P-256).
- **Per wrong candidate**, the first failing GCM check already rejects with overwhelming probability; extra shards add negligible false-positive suppression beyond the first.
- Each delivery uses a **different** ephemeral agreement key and HKDF salt. The attacker does **not** get a system of equations in `Bob_private` with a shared shortcut — only independent consistency checks for the **same** candidate.
- Knowing `DEK_i` for some posts (because a co-recipient’s key was stolen) makes the inner check explicit (`decrypt == DEK_i`) but still does not shrink the candidate space.

So a server storing **10 or 10,000** posts does **not** turn recipient private-key search into “128-bit divided by N.” Volume increases **how much plaintext one successful guess unlocks**, not how cheap the guess is.

#### Attack path 2 — Server holds many decrypted messages and DEKs

Suppose the server compromised **Carol’s** private key and decrypted every post Carol was on. It now holds `(plaintext_j, DEK_j, encryptedContent_j)` for a large `j`, and still holds everyone’s shards and cores.

**What bulk decryption gives:**

- Read access to every thread Carol belonged to — including comments via `HKDF(parent_DEK, salt)` (ADR 0005).
- The same **co-recipient bundle** as in the single-message case: DEK + plaintext + public fields, repeated many times.

**What it does not give:**

- **Bob’s private key** — each post’s Bob shard is wrapped under a **different** ephemeral agreement key. Ten thousand known DEKs are ten thousand independent AES-GCM wrappers around values the attacker already knows; they do not combine into a weaker ECDLP instance for `Bob_private`.
- **Decrypt posts Carol never had access to** — those DEKs are still inside shards that require **Bob’s** (or another recipient’s) long-term key, or the per-delivery ephemeral private key from encrypt time.
- **A dictionary or statistical attack on future DEKs** — message DEKs are uniform random per post; past `(plaintext, DEK)` pairs do not predict future keys.

**Comments on the same post** are the one place the same DEK appears many times. A thread with 500 comments yields 500 `(comment plaintext, encryptedContent, salt)` tuples under one parent DEK. Comment keys are `HKDF(DEK, salt)` with a **fresh salt per comment** — independent AES keys. Many comment plaintexts do not let the server invert HKDF or recover the parent DEK without already having it.

#### Attack path 3 — Server guesses sender or ephemeral keys across history

| Target key                           | Many messages help?                                                         | Under this app’s wrap                                                               |
| ------------------------------------ | --------------------------------------------------------------------------- | ----------------------------------------------------------------------------------- |
| **Recipient `Bob_private`**          | No meaningful reduction in guess work                                       | ECDHE; ~128-bit per key                                                             |
| **Sender `Alice_private`**           | No reduction; **but** one success opens **Alice’s own** shards on all posts | Does **not** open Bob’s shards (ADR 0003)                                           |
| **Per-delivery `ephemeral_private`** | No cross-message amortization                                               | Each post/share is a separate ~128-bit target; success opens **that delivery only** |

Under the **rejected** static sender×recipient ECDH design, guessing `Alice_private` once would recompute the **same** pairwise shared secret for every Alice→Bob post and unlock **all** historical Bob shards after one success. That is a **coverage** amplification across N messages, not a lower exponent on ECDLP — but it is exactly why ADR 0003 rejected static ECDH.

#### Work factor vs coverage (summary)

```text
                    ONE message          N messages (same recipient)
Work to guess       ~2^128               ~2^128          (unchanged)
Bob_private

Posts readable      1 Bob shard          N Bob shards    (after success)
after Bob break

Posts readable      Alice’s shard only   Alice’s shards  (ECDHE; not Bob’s)
after Alice break
```

**Bottom line for confidentiality:** storing or decrypting a huge history does **not** weaken the cryptographic work factor for breaking **another user’s** long-term private key. The risk from volume is **operational** — more data at stake if any single key is compromised, more threads exposed when a co-recipient’s key leaks — not a shortcut that makes ECDLP or AES key search tractable.

#### Implementation assumptions this relies on

These properties must stay true for the “volume does not help” claim to hold:

- **New random DEK** per post body (`generateManifestDek`).
- **New ephemeral agreement key pair** per feed post and per share delivery (`generateManifestEphemeralAgreementKeyPair`).
- **New random HKDF salt and GCM IV** per shard (`derivePerRecipientKek`, `buildKeyManifestEntryForRecipient`).
- **No nonce/key reuse** across wraps or bodies — GCM and ECDHE security degrade catastrophically if reused; the code path generates fresh material per operation.

If any of these were violated in a future change, bulk ciphertext could become exploitable independent of message count. That would require a new ADR.

### What this does **not** claim

| Situation                                                                 | Outcome                                                                                                                |
| ------------------------------------------------------------------------- | ---------------------------------------------------------------------------------------------------------------------- |
| Attacker already has Bob’s `.jwk` file or device                          | Private key is compromised directly — not via algebra from the DEK                                                     |
| Attacker learns DEK via **any** path                                      | Can read the post and all comments on the thread — **read** access, not **sign-as-Bob**                                |
| One user’s private key compromised (`.jwk` leak, device access, coercion) | Attacker can decrypt **every post that user could access**; readable history grows with how many threads they joined   |
| Malicious server holds **N** decrypted posts and DEKs as a corpus         | Does **not** by itself lower work to recover **other users’** private keys or open posts that user never had access to |
| Malicious server holds **all shards** for N posts, no private keys        | Guess-and-verify against `Bob_private` remains ~128-bit; N shards are redundant oracles, not a weaker ECDLP instance   |
| Nation-state budget for 128-bit ECDLP                                     | Theoretically possible for any P-256 key; not specific to knowing the DEK or message count                             |

The security property documented here is **cryptographic non-recoverability of the long-term private key from message artifacts**, not protection against key theft, coercion, or endpoint compromise.

## Consequences

### Positive

- Co-recipients and sharers who learn the DEK gain **confidentiality of the thread**, not the ability to forge Bob’s signatures or unwrap **future** shards addressed only to Bob on unrelated deliveries without his key.
- Share and comment models (ADR 0005) can safely reuse one DEK without implying that “everyone who read the post can impersonate everyone else.”
- Product and support docs can point here when users ask whether shared plaintext enables private-key recovery.

### Negative / limitations

- **Read vs write**: thread members with the DEK can read all comment plaintext and attribute authors via `senderPublicJwk` — a privacy concern, but distinct from private-key recovery.
- **Recipient key guessing** against Bob’s shard remains theoretically possible at ~128-bit cost; knowing the DEK or holding many decrypted posts does not remove that baseline (ADR 0003).
- **Volume increases blast radius after any single break** — compromising Carol’s key decrypts every post she was on; compromising Bob’s key opens every shard addressed to Bob. Bulk history makes the **payoff** larger, not the **per-key guess work** smaller.
- This ADR does not address **quantum** threats to P-256; a future algorithm migration would need its own record.

## Alternatives considered

### Rely only on ADR 0003 brute-force section

ADR 0003 already documents guess-and-verify against server-held shards and states that P-256 private keys retain ~128-bit ECDLP security. That material is **necessary** background but **not sufficient** as the only place this question is answered.

#### What ADR 0003 is framed around

ADR 0003 is an infrastructure decision: ephemeral sender ECDHE vs static sender×recipient ECDH for per-recipient shard wrapping. Its brute-force section uses this story:

1. Attacker holds **Bob’s shard** (`encryptedDek`, salt, iv, Bob’s `publicKey`) and the core’s `ephemeralPublicKey`.
2. Attacker does **not** yet have the message DEK.
3. They guess candidate private keys, run `ECDHE → HKDF → AES-GCM`, and treat **GCM decrypt success** as proof they found the right key and recovered the **DEK**.

The win condition is **shard → DEK**. The threat actors are a **malicious or breached server**, a **leaked sender key** used against **other users’ shards**, and ACL misconfiguration — not a legitimate co-recipient who decrypted normally.

#### What ADR 0005 changes

ADR 0005 states that one post has **one DEK** and **one plaintext** for every thread member. After a normal decrypt, Carol (a co-recipient) legitimately holds:

| Carol has            | Source                                                    |
| -------------------- | --------------------------------------------------------- |
| Raw DEK              | Her own shard unwrap                                      |
| Plaintext            | `AES-GCM(DEK, encryptedContent)`                          |
| Public wire fields   | Core payload (`ephemeralPublicKey`, `senderPublicJwk`, …) |
| Possibly Bob’s shard | Leaky ACL, export, backup, or insider curiosity           |

Carol is not breaking in. She is exercising the **intended** read path. The question she (or a security reviewer) may ask is different from ADR 0003’s:

> “I have the DEK and Bob’s wrapping ciphertext. The only missing piece in the decrypt equation is Bob’s private key. Can I **solve for it**?”

That sounds like a known-plaintext or “almost full equation” attack — especially because Bob’s `encryptedDek` wraps a value Carol **already knows**.

#### Two questions that sound similar but are not

|                    | ADR 0003 question                     | This ADR’s question                                                    |
| ------------------ | ------------------------------------- | ---------------------------------------------------------------------- |
| **Starting point** | Has shard; wants DEK                  | **Already has DEK** (and plaintext)                                    |
| **Goal**           | Recover **message key**               | Recover **Bob’s long-term identity key**                               |
| **Typical actor**  | Server attacker, wrong party’s shards | Co-recipient, sharer, thread member                                    |
| **If successful**  | Read this post                        | Impersonate Bob elsewhere, forge signatures, open unrelated Bob shards |
| **GCM oracle**     | Success = unknown DEK revealed        | Success = confirms guess; DEK was known all along                      |

ADR 0003 does not spell out that **read access ≠ identity compromise** in thread-membership terms. ADR 0005 documents what thread members **can read** but does not explicitly say they **cannot become Bob**.

#### Why the intuitive attack feels plausible

Several facts together suggest (incorrectly) that the DEK might leak the private key:

1. **Same DEK everywhere** — Bob’s shard encrypts the same 32 bytes Carol already holds; `encryptedDek` looks like a redundant wrapper around a known secret.
2. **Symmetric-crypto intuition** — In some broken designs, known plaintext weakens the system; people reasonably ask whether “everyone decrypts the same thing” collapses security.
3. **Visible public keys** — `Bob_public` is in the shard, `ephemeralPublicKey` is in the core; only `Bob_private` seems missing from a complete picture.
4. **Comments amplify exposure** — Thread members derive comment keys from the parent DEK (ADR 0005); the shared “floor” feels like shared **identity**, not just shared **content**.

The answer is that the wrap chain remains one-way: knowing the DEK does not let you invert AES-GCM to KEK, invert HKDF to the ECDH shared secret, or solve ECDLP for `Bob_private` except by the same ~128-bit brute force ADR 0003 already describes. Knowing the DEK only makes the guess-and-verify check slightly more explicit (`decrypt == known_DEK` instead of “GCM tag OK”); it does **not** shrink the search space.

#### Read access vs signing identity

This distinction is what “tied to thread membership” means in practice:

| Privilege                                                   | Thread member with DEK?   | Requires Bob’s private key? |
| ----------------------------------------------------------- | ------------------------- | --------------------------- |
| Read post body and all comments on the thread               | **Yes**                   | No                          |
| Know who signed the post / comments (`senderPublicJwk`)     | **Yes** (public metadata) | No                          |
| Forge Bob’s signature on a new message                      | No                        | **Yes**                     |
| Unwrap shards addressed only to Bob on **other** deliveries | No                        | **Yes**                     |

ADR 0006 exists so that ADR 0005’s shared-DEK model is not misread as “everyone who read the post can impersonate everyone else.”

**Rejected as sole documentation:** point users only at ADR 0003’s brute-force section without this record.

### Per-recipient DEK re-encryption to hide the DEK from co-recipients

- Would prevent co-recipients from seeing the same DEK.
- **Rejected:** unnecessary for private-key safety; increases size and complexity; does not match the feed/share product model (ADR 0005).

## References

- Related ADRs:
  - [0003](./0003-ephemeral-sender-ecdhe-for-key-manifest-shards.md) — ECDHE wrap, guess-and-verify, ECDLP work factor
  - [0005](./0005-feed-share-and-comments-parent-dek-model.md) — shared DEK across recipients, comments, and share
