import {
  ecPublicJwkThumbprintSha256,
  slimEcPublicJwk,
} from '@encrypt/core/crypto/jwkThumbprint';
import type { FeedApi, FeedApiRequestOptions } from '@encrypt/core/api/feedApi';
import {
  loadFeedLabUserByUsername,
  saveFeedLabUser,
} from '@lab/services/db/storedUsers.ts';

export type FeedLabRegisteredUser = {
  keyId: string;
  username: string;
  publicKey: { x: string; y: string };
};

export type RegisterFeedLabRecipientResult =
  | { status: 'registered'; keyId: string; user: FeedLabRegisteredUser }
  | {
      status: 'already_saved';
      keyId: string;
      username: string;
    }
  | { status: 'error'; message: string };

function isUserAlreadyExistsError(message: string): boolean {
  return message.startsWith('User already exists');
}

export async function registerFeedLabRecipient(
  api: FeedApi,
  username: string,
  publicJwk: JsonWebKey,
  options?: FeedApiRequestOptions,
): Promise<RegisterFeedLabRecipientResult> {
  const trimmedName = username.trim();
  const slimJwk = slimEcPublicJwk(publicJwk);
  const keyId = await ecPublicJwkThumbprintSha256(slimJwk);
  const x = slimJwk.x;
  const y = slimJwk.y;

  if (!x || !y) {
    return { status: 'error', message: 'Public key must include x and y.' };
  }

  const user: FeedLabRegisteredUser = {
    keyId,
    username: trimmedName,
    publicKey: { x, y },
  };

  const saveLocally = async (): Promise<RegisterFeedLabRecipientResult> => {
    await saveFeedLabUser(trimmedName, slimJwk);
    return { status: 'registered', keyId, user };
  };

  try {
    await api.postUser({ publicKey: { x, y } }, options);
    return await saveLocally();
  } catch (e) {
    const message = e instanceof Error ? e.message : 'Failed to register user.';

    if (!isUserAlreadyExistsError(message)) {
      return { status: 'error', message };
    }

    const existing = await loadFeedLabUserByUsername(trimmedName);
    if (existing) {
      return {
        status: 'already_saved',
        keyId,
        username: existing.username,
      };
    }

    return await saveLocally();
  }
}
