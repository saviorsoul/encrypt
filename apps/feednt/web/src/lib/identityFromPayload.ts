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

const senderIdentityCache = new Map<string, FeedIdentity | null>();
const senderIdentityPending = new Map<string, Promise<FeedIdentity | null>>();

async function resolveSenderIdentityFromCorePayload(
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

export function getCachedSenderIdentityFromCorePayload(
  payload: string,
): FeedIdentity | null | undefined {
  if (!senderIdentityCache.has(payload)) {
    return undefined;
  }
  return senderIdentityCache.get(payload) ?? null;
}

export function getSenderIdentityFromCorePayload(
  payload: string,
): Promise<FeedIdentity | null> {
  if (senderIdentityCache.has(payload)) {
    return Promise.resolve(senderIdentityCache.get(payload) ?? null);
  }

  let pending = senderIdentityPending.get(payload);
  if (!pending) {
    pending = resolveSenderIdentityFromCorePayload(payload).then((identity) => {
      senderIdentityCache.set(payload, identity);
      senderIdentityPending.delete(payload);
      return identity;
    });
    senderIdentityPending.set(payload, pending);
  }
  return pending;
}

export async function warmSenderIdentitiesForMessages(
  messages: ReadonlyArray<{ payload: string }>,
): Promise<void> {
  await Promise.all(
    messages.map((message) =>
      getSenderIdentityFromCorePayload(message.payload),
    ),
  );
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
