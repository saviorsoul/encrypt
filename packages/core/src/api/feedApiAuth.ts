import type { UploadedPrivateKeyMaterial } from '../crypto/privateKeyMaterial.ts';
import {
  authHeadersToRecord,
  computeAuthTimeSlot,
  signAuthProof,
  type AuthRequestDescriptor,
  type AuthRequestHeaders,
} from '../crypto/authProof.ts';

export type FeedApiAuthProvider = {
  getAuthHeaders: (
    request: AuthRequestDescriptor,
  ) => Promise<AuthRequestHeaders>;
};

export type FeedApiPerRequestAuth = {
  authMaterial: UploadedPrivateKeyMaterial;
};

type AuthHeaderCache = {
  fingerprint: string;
  headers: AuthRequestHeaders;
};

let headerCache: AuthHeaderCache | null = null;

export function clearFeedApiAuthHeaderCache(): void {
  headerCache = null;
}

function requestFingerprint(
  material: UploadedPrivateKeyMaterial,
  timeSlot: number,
  request: AuthRequestDescriptor,
): string {
  return JSON.stringify({
    keyId: material.keyId,
    timeSlot,
    method: request.method.toUpperCase(),
    path: request.path,
    query: request.query ?? null,
    body: request.body ?? null,
  });
}

export async function buildAuthHeadersFromMaterial(
  material: UploadedPrivateKeyMaterial,
  request: AuthRequestDescriptor,
  timeSlot = computeAuthTimeSlot(),
): Promise<AuthRequestHeaders> {
  const fingerprint = requestFingerprint(material, timeSlot, request);
  if (headerCache && headerCache.fingerprint === fingerprint) {
    return headerCache.headers;
  }

  const signature = await signAuthProof(
    material.ecdsaSignPrivateKey,
    material.keyId,
    timeSlot,
    request,
  );
  const headers: AuthRequestHeaders = {
    keyId: material.keyId,
    publicKey: material.publicKey,
    timeSlot,
    signature,
  };
  headerCache = { fingerprint, headers };
  return headers;
}

export function createFeedApiAuthProvider(
  getMaterial: () => Promise<UploadedPrivateKeyMaterial | null>,
): FeedApiAuthProvider {
  return {
    async getAuthHeaders(
      request: AuthRequestDescriptor,
    ): Promise<AuthRequestHeaders> {
      const material = await getMaterial();
      if (!material) {
        throw new Error(
          'Private key is required for this API request. Unlock your identity first.',
        );
      }
      return buildAuthHeadersFromMaterial(material, request);
    },
  };
}

export async function resolveAuthHeaderRecord(
  auth: FeedApiAuthProvider | undefined,
  request: AuthRequestDescriptor,
  perRequest?: FeedApiPerRequestAuth,
): Promise<Record<string, string>> {
  if (perRequest) {
    const headers = await buildAuthHeadersFromMaterial(
      perRequest.authMaterial,
      request,
    );
    return authHeadersToRecord(headers);
  }
  if (!auth) {
    throw new Error(
      'API authentication is not configured. Provide a private key session.',
    );
  }
  const headers = await auth.getAuthHeaders(request);
  return authHeadersToRecord(headers);
}

export type { AuthRequestDescriptor } from '../crypto/authProof.ts';
