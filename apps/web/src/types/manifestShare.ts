import type { MANIFEST_SHARE_WRAP } from '@/constants/manifestShare.ts';

export type ManifestShareSignableBody = {
  version: number;
  wrap: typeof MANIFEST_SHARE_WRAP;
  parentMessageId: string;
  sharerPublicJwk: JsonWebKey;
  ephemeralPublicKey: JsonWebKey;
};

/** Share metadata in export/import JSON and stored delivery core (no keyManifest). */
export type ManifestShareWirePayload = ManifestShareSignableBody & {
  sharerSignature: string;
};
