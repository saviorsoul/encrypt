import type { MANIFEST_WRAP } from '@/crypto/manifestConstants.ts';

/**
 * Recipient identity + public ECDH material for manifest KEK derivation (encrypt path).
 * Peer private keys never belong here — demo decrypt uses `MockExternalRecipientMaterial` (`mockExternalRecipient.ts`) instead.
 */
export interface ManifestRecipientKeys {
  keyId: string;
  publicKey: CryptoKey;
}

/**
 * Per-recipient encrypted DEK in the key manifest; `keyId` matches the map key in `keyManifest`
 */
export interface KeyManifestRecipientPayload {
  keyId: string;
  publicKey?: JsonWebKey;
  iv: string;
  salt: string;
  encryptedDek: string;
}

export type KeyManifestMap = Record<string, KeyManifestRecipientPayload>;

/** AES-GCM ciphertext fields on the wire (iv + ciphertext). */
export type ManifestEncryptedContentSignableBody = {
  iv: string;
  ciphertext: string;
};

/** Fields covered by the top-level {@link ManifestPayload.senderSignature}. */
export type ManifestSignableBody = {
  version: number;
  wrap: typeof MANIFEST_WRAP;
  senderPublicJwk: JsonWebKey;
  /** Per-manifest ECDHE public JWK paired with ephemeral private discarded after encrypt — agreement only. */
  ephemeralPublicKey: JsonWebKey;
  encryptedContent: ManifestEncryptedContentSignableBody;
};

/** Signable body plus per-recipient key manifest, assembled before signing. */
export type ManifestAssembly = ManifestSignableBody & {
  keyManifest: KeyManifestMap;
};

export interface ManifestPayload extends ManifestAssembly {
  /** ECDSA P-256 / SHA-256 (ES256) over {@link ManifestSignableBody}. */
  senderSignature: string;
}

/** Manifest stored in IndexedDB without per-recipient keyManifest shards. */
export type ManifestCorePayload = ManifestSignableBody & {
  senderSignature: string;
};
