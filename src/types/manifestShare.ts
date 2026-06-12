import type { MANIFEST_SHARE_WRAP } from '@/constants/manifestShare.ts';

/** Share delivery core stored in `messages.payload` (no keyManifest, no encryptedContent). */
export type ManifestShareCorePayload = {
  version: number;
  wrap: typeof MANIFEST_SHARE_WRAP;
  parentMessageId: string;
  sharerPublicJwk: JsonWebKey;
  /** Per-share ECDHE public JWK — private key discarded after wrap completes. */
  ephemeralPublicKey: JsonWebKey;
  sharerSignature: string;
};

export type ManifestShareSignableBody = Omit<
  ManifestShareCorePayload,
  'sharerSignature'
>;
