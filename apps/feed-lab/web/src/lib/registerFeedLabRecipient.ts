import {
  ecPublicJwkThumbprintSha256,
  slimEcPublicJwk,
} from '@encrypt/core/crypto/jwkThumbprint';
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

export { isUserAlreadyExistsError };

export type RegisterFeedLabRecipientOptions = {
  acceptedInvitationToken?: string;
};

export async function registerFeedLabRecipient(
  ownerKeyId: string,
  username: string,
  publicJwk: JsonWebKey,
  options?: RegisterFeedLabRecipientOptions,
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

  const existing = await loadFeedLabUserByUsername(ownerKeyId, trimmedName);
  if (existing) {
    if (existing.keyId === keyId) {
      return {
        status: 'already_saved',
        keyId,
        username: existing.username,
      };
    }
    return {
      status: 'error',
      message: `"${trimmedName}" already exists. Choose a unique name.`,
    };
  }

  await saveFeedLabUser(ownerKeyId, trimmedName, slimJwk, {
    acceptedInvitationToken: options?.acceptedInvitationToken,
  });
  return { status: 'registered', keyId, user };
}
