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
  /** One or two short sentences for the glossary list. */
  summary: string;
  parentId?: GlossaryTermId;
  /** Other terms to read next (shown as links below the summary). */
  seeAlso?: GlossaryTermId[];
};

export const GLOSSARY_TERMS: GlossaryTerm[] = [
  {
    id: 'symmetric-key',
    title: 'Symmetric key',
    summary:
      'A single secret used for both encryption and decryption. Anyone who holds the key can read or alter protected data, so it must only be shared over trusted channels or protected with another layer (such as asymmetric wrapping).',
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
    seeAlso: ['hkdf', 'kek', 'key-manifest', 'iv-nonce'],
  },
  {
    id: 'asymmetric-key',
    title: 'Asymmetric key',
    summary:
      'A mathematically related key pair: one part is kept private, the other can be distributed publicly. Typical uses include key agreement (deriving shared secrets) and digital signatures (proving who created or approved data).',
    seeAlso: ['private-key', 'public-key', 'ecdh', 'signing'],
  },
  {
    id: 'private-key',
    title: 'Private key',
    parentId: 'asymmetric-key',
    summary:
      'The secret half of an asymmetric key pair. It must be stored and handled confidentially; possession of the private key is what grants the ability to decrypt wrapped material or produce valid signatures.',
    seeAlso: ['ecdh', 'ecdhe', 'public-key'],
  },
  {
    id: 'public-key',
    title: 'Public key',
    parentId: 'asymmetric-key',
    summary:
      'The non-secret half of an asymmetric key pair, safe to publish or distribute. Others use it to encrypt or agree keys for you, or to verify signatures that only your matching private key could have created.',
    seeAlso: ['ecdh', 'key-manifest'],
  },
  {
    id: 'ecdh',
    title: 'ECDH',
    parentId: 'asymmetric-key',
    summary:
      'Elliptic Curve Diffie-Hellman: a key-agreement protocol where two parties each use their own key material and arrive at the same shared secret without transmitting that secret on the network.',
    seeAlso: ['ecdhe', 'private-key', 'public-key', 'hkdf', 'p-256'],
  },
  {
    id: 'ecdhe',
    title: 'ECDHE',
    parentId: 'asymmetric-key',
    summary:
      'ECDH Ephemeral: the sender uses a one-time agreement key pair per message and discards the private key after wrapping. Unlike in TLS, this is not mainly for forward secrecy - here ECDHE separates signing from agreement and ensures each recipient’s server-delivered shard opens only with that recipient’s long-term key.',
    seeAlso: ['ecdh', 'key-manifest', 'hkdf'],
  },
  {
    id: 'p-256',
    title: 'P-256 and other curves',
    parentId: 'asymmetric-key',
    summary:
      'P-256 (also called secp256r1) is a standard NIST elliptic curve commonly used with ECDH and ECDSA. Other curves (for example P-384 or Curve25519) trade off size, performance, and ecosystem support; all parties must use the same curve and algorithms.',
    seeAlso: ['ecdh', 'ecdsa'],
  },
  {
    id: 'key-manifest',
    title: 'Key manifest',
    summary:
      'A structured bundle of per-recipient keying material—such as encrypted content keys, IVs, salts, and public keys—so each intended recipient can recover the keys needed to decrypt the payload. It is separate from the encrypted message body itself.',
    seeAlso: ['dek', 'kek', 'hkdf', 'iv-nonce', 'ecdhe'],
  },
  {
    id: 'iv-nonce',
    title: 'IV / nonce',
    summary:
      'Initialization vector or nonce: a value that must be unique (or unique per key) for each encryption under the same key, so identical plaintexts produce different ciphertexts. For AES-GCM, reuse of an IV with the same key is unsafe.',
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
    seeAlso: ['ecdsa', 'public-key', 'private-key'],
  },
  {
    id: 'ecdsa',
    title: 'ECDSA',
    parentId: 'signing',
    summary:
      'Elliptic Curve Digital Signature Algorithm: produces compact signatures using elliptic-curve keys. A common profile is ECDSA on P-256 with SHA-256, referred to as ES256 in JSON Web Algorithms (JWA).',
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
