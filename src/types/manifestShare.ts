import type { MANIFEST_SHARE_WRAP } from '@/constants/manifestShare.ts';

/** Share metadata in export/import JSON (no local message ids). */
export type ManifestShareWirePayload = {
  version: number;
  wrap: typeof MANIFEST_SHARE_WRAP;
  sharerPublicJwk: JsonWebKey;
  /** Per-share ECDHE public JWK — private key discarded after wrap completes. */
  ephemeralPublicKey: JsonWebKey;
  sharerSignature: string;
};

/** Share delivery core stored in `messages.payload` (no keyManifest, no encryptedContent). */
export type ManifestShareCorePayload = ManifestShareWirePayload & {
  parentMessageId: string;
};

export type ManifestShareSignableBody = Omit<
  ManifestShareWirePayload,
  'sharerSignature'
>;
