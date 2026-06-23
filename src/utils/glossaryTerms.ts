export const GLOSSARY_TERM_IDS = [
  'symmetric-key',
  'aes-256',
  'aes-gcm',
  'dek',
  'kek',
  'salt',
  'asymmetric-key',
  'private-key',
  'public-key',
  'ecdh',
  'ecdhe',
  'p-256',
  'key-manifest',
  'iv-nonce',
  'hkdf',
  'signing',
  'ecdsa',
] as const;

export type GlossaryTermId = (typeof GLOSSARY_TERM_IDS)[number];

export type GlossaryTerm = {
  id: GlossaryTermId;
  title: string;
  summary: string;
  inAppPurpose?: string;
  parentId?: GlossaryTermId;
  seeAlso?: GlossaryTermId[];
};

export const GLOSSARY_TERMS: GlossaryTerm[] = [
  {
    id: 'symmetric-key',
    title: 'Symmetric key',
    summary:
      'A single secret used for both encryption and decryption. Anyone who holds the key can read or alter protected data, so it must only be shared over trusted channels or protected with another layer (such as asymmetric wrapping).',
    inAppPurpose:
      'Messages are encrypted with symmetric AES keys. Symmetric encryption is much faster and cost grows roughly in proportion to size of plaintext. Public-key algorithms gets significantly slower on long messages and the ciphertext gets much larger than plaintext.',
    seeAlso: ['aes-256', 'aes-gcm', 'dek', 'kek', 'salt'],
  },
  {
    id: 'aes-256',
    title: 'AES-256',
    parentId: 'symmetric-key',
    summary:
      'Advanced Encryption Standard with a 256-bit key length. It is widely used for bulk data encryption and is considered a strong default when implemented with a modern mode such as GCM.',
    seeAlso: ['dek', 'kek', 'aes-gcm'],
  },
  {
    id: 'aes-gcm',
    title: 'AES-GCM',
    parentId: 'symmetric-key',
    summary:
      'AES in Galois/Counter Mode: an authenticated encryption mode that provides both confidentiality and integrity. Decryption verifies an authentication tag; modified ciphertext or wrong key/IV should fail verification instead of yielding trusted plaintext.',
    seeAlso: ['aes-256', 'iv-nonce', 'dek', 'kek'],
  },
  {
    id: 'dek',
    title: 'DEK',
    parentId: 'symmetric-key',
    summary:
      'Data Encryption Key: a symmetric key used to encrypt the actual content (the data at rest or in transit). In envelope encryption, the DEK is often random per object or message and itself encrypted separately for each recipient.',
    inAppPurpose:
      'One random DEK per feed message encrypts the post body once. Every intended recipient unwraps the same DEK via their own shard. Comments reuse that parent DEK instead of generating a new DEK.',
    seeAlso: ['kek', 'aes-256', 'aes-gcm', 'key-manifest'],
  },
  {
    id: 'kek',
    title: 'KEK',
    parentId: 'symmetric-key',
    summary:
      'Key Encryption Key: a symmetric key whose job is to encrypt (wrap) other keys, such as a DEK, rather than the user payload directly. Different recipients can receive different KEKs wrapping the same DEK.',
    seeAlso: ['dek', 'hkdf', 'aes-gcm', 'key-manifest', 'salt'],
  },
  {
    id: 'salt',
    title: 'Salt',
    parentId: 'symmetric-key',
    summary:
      'Extra input for key derivation (for example in HKDF) so the same underlying secret does not always yield the same derived key. In the manifest flow, each recipient gets a random salt stored in the key manifest so they can re-derive the same KEK from the ECDH shared secret.',
    inAppPurpose:
      'Each manifest shard stores a random 32-byte salt so the recipient can re-derive the same KEK from the ECDH shared secret. Comments carry their own salt so the comment AES key is distinct from the raw message DEK.',
    seeAlso: ['hkdf', 'kek', 'key-manifest', 'iv-nonce'],
  },
  {
    id: 'asymmetric-key',
    title: 'Asymmetric key',
    summary:
      'A mathematically related key pair: one part is kept private, the other can be distributed publicly. Typical uses include key agreement (deriving shared secrets) and digital signatures (proving who created or approved data).',
    inAppPurpose:
      'Your long-term key pair is your identity on the feed: the public key appears in payloads and manifest shards; the private key stays local and is required to decrypt your shards and sign posts and comments.',
    seeAlso: ['private-key', 'public-key', 'ecdh', 'signing'],
  },
  {
    id: 'private-key',
    title: 'Private key',
    parentId: 'asymmetric-key',
    summary:
      'The secret half of an asymmetric key pair. It must be stored and handled confidentially; possession of the private key is what grants the ability to decrypt wrapped material or produce valid signatures.',
    inAppPurpose:
      'Stored only on your device. You select it when decrypting; it unwraps your manifest shard (recipient private x sender ephemeral public), signs outgoing posts and comments, and opens share deliveries.',
    seeAlso: ['ecdh', 'ecdhe', 'public-key'],
  },
  {
    id: 'public-key',
    title: 'Public key',
    parentId: 'asymmetric-key',
    summary:
      'The non-secret half of an asymmetric key pair, safe to publish or distribute. Others use it to encrypt or agree keys for you, or to verify signatures that only your matching private key could have created.',
    inAppPurpose:
      'Each recipient is identified by a thumbprint of their public JWK (`keyId`). Shards store the recipient public key. The feed core payload carries the sender’s public key for signature verification.',
    seeAlso: ['ecdh', 'key-manifest'],
  },
  {
    id: 'ecdh',
    title: 'ECDH',
    parentId: 'asymmetric-key',
    summary:
      'Elliptic Curve Diffie-Hellman: a key-agreement protocol where two parties each use their own key material and arrive at the same shared secret without transmitting that secret on the network.',
    inAppPurpose:
      'Used for DEK wrapping: the sender’s ephemeral private key and each recipient’s public key (or the reverse on decrypt) produce the shared secret that HKDF turns into a KEK.',
    seeAlso: ['ecdhe', 'private-key', 'public-key', 'hkdf', 'p-256'],
  },
  {
    id: 'ecdhe',
    title: 'ECDHE',
    parentId: 'asymmetric-key',
    summary:
      'ECDH Ephemeral: the sender uses a one-time agreement key pair per message and discards the private key after wrapping.',
    inAppPurpose:
      'Unlike in TLS, it is not for forward secrecy - here ECDHE separates signing from agreement and ensures each recipient’s server-delivered shard opens only with that recipient’s long-term key.',
    seeAlso: ['ecdh', 'key-manifest', 'hkdf'],
  },
  {
    id: 'p-256',
    title: 'P-256 and other curves',
    parentId: 'asymmetric-key',
    summary:
      'P-256 (also called secp256r1) is a standard NIST elliptic curve commonly used with ECDH and ECDSA. Other curves (for example P-384 or Curve25519) trade off size, performance, and ecosystem support; all parties must use the same curve and algorithms.',
    inAppPurpose:
      'All user keys, ephemeral agreement keys, and signatures in this app use P-256. Key generation, ECDH unwrap, and ES256 signing all assume this curve.',
    seeAlso: ['ecdh', 'ecdsa'],
  },
  {
    id: 'key-manifest',
    title: 'Key manifest',
    summary:
      'A structured bundle of per-recipient keying material—such as encrypted content keys, IVs, salts, and public keys—so each intended recipient can recover the keys needed to decrypt the payload. It is separate from the encrypted message body itself.',
    inAppPurpose:
      'Split for storage: each recipient’s shard (`salt`, `iv`, `encryptedDek`, `publicKey`) is stored separately by `keyId`. It also helps to mimic future database structure.',
    seeAlso: ['dek', 'kek', 'hkdf', 'iv-nonce', 'ecdhe'],
  },
  {
    id: 'iv-nonce',
    title: 'IV / nonce',
    summary:
      'Initialization vector or nonce: a value that must be unique (or unique per key) for each encryption under the same key, so identical plaintexts produce different ciphertexts. For AES-GCM, reuse of an IV with the same key is unsafe.',
    inAppPurpose:
      'A fresh random IV accompanies every AES-GCM operation: the message body, each DEK wrap in a manifest shard, and each encrypted comment.',
    seeAlso: ['aes-gcm', 'dek', 'kek', 'hkdf'],
  },
  {
    id: 'hkdf',
    title: 'HKDF',
    summary:
      'HMAC-based Key Derivation Function: a standard way to expand input key material with optional salt and context info into one or more cryptographically strong keys. It is often used after ECDH because the raw shared secret is not ideal to use directly as an AES key.',
    seeAlso: ['kek', 'salt', 'ecdhe', 'iv-nonce'],
  },
  {
    id: 'signing',
    title: 'Signing',
    summary:
      'Creating a digital signature over a message or structured data using a private key. Verifiers use the corresponding public key to check that the data was not altered and was signed by whoever holds that private key.',
    inAppPurpose:
      'Before decrypting, the app verifies the sender’s signature on the manifest core payload (and on comment payloads).',
    seeAlso: ['ecdsa', 'public-key', 'private-key'],
  },
  {
    id: 'ecdsa',
    title: 'ECDSA',
    parentId: 'signing',
    summary:
      'Elliptic Curve Digital Signature Algorithm: produces compact signatures using elliptic-curve keys. A common profile is ECDSA on P-256 with SHA-256, referred to as ES256 in JSON Web Algorithms (JWA).',
    inAppPurpose:
      'Produces sender signature on feed posts and comments (ES256 over a canonical JSON body)',
    seeAlso: ['signing', 'p-256'],
  },
];

const termById = new Map(GLOSSARY_TERMS.map((t) => [t.id, t]));

export function getGlossaryTerm(id: GlossaryTermId): GlossaryTerm | undefined {
  return termById.get(id);
}

/** Top-level sections in display order; children follow their parent. */
export function glossaryTermsInDisplayOrder(): GlossaryTerm[] {
  const roots = GLOSSARY_TERMS.filter((t) => !t.parentId);
  const ordered: GlossaryTerm[] = [];
  for (const root of roots) {
    ordered.push(root);
    for (const child of GLOSSARY_TERMS.filter((t) => t.parentId === root.id)) {
      ordered.push(child);
    }
  }
  return ordered;
}
