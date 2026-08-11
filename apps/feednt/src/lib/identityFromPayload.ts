import { parseManifestShareCorePayload } from '@encrypt/core/crypto/manifestShare';
import { parseManifestCorePayload } from '@encrypt/core/crypto/manifestStorage';
import { ecPublicCoordsFromJwk } from '@encrypt/core/crypto/ecPublicKey';
import { ecPublicJwkThumbprintSha256 } from '@encrypt/core/crypto/jwkThumbprint';
import type { CommentPayload } from '@encrypt/core/types/comment';
import { parseBaseJsonObjectOrThrow } from '@encrypt/core/utils/validateBaseJsonText';

export type FeedIdentity = {
  keyId: string;
  publicKey: { x: string; y: string };
};

export async function getSenderIdentityFromCorePayload(
  payload: string,
): Promise<FeedIdentity | null> {
  try {
    const parsed = parseManifestCorePayload(payload);
    const publicKey = ecPublicCoordsFromJwk(parsed.senderPublicJwk);
    const keyId = await ecPublicJwkThumbprintSha256(parsed.senderPublicJwk);
    return { keyId, publicKey };
  } catch {
    return null;
  }
}

export async function getCommentAuthorIdentityFromPayload(
  payload: string,
): Promise<FeedIdentity | null> {
  try {
    const parsed = parseBaseJsonObjectOrThrow(
      payload,
    ) as unknown as CommentPayload;
    const publicKey = ecPublicCoordsFromJwk(parsed.senderPublicJwk);
    const keyId = await ecPublicJwkThumbprintSha256(parsed.senderPublicJwk);
    return { keyId, publicKey };
  } catch {
    return null;
  }
}

export async function getSharerIdentityFromSharePayload(
  payload: string,
): Promise<FeedIdentity | null> {
  try {
    const parsed = parseManifestShareCorePayload(payload);
    const publicKey = ecPublicCoordsFromJwk(parsed.sharerPublicJwk);
    const keyId = await ecPublicJwkThumbprintSha256(parsed.sharerPublicJwk);
    return { keyId, publicKey };
  } catch {
    return null;
  }
}
