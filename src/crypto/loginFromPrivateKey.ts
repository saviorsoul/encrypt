import {
  ecPublicJwkThumbprintSha256,
  slimEcPublicJwk,
} from '@/crypto/jwkThumbprint.ts';
import {
  loadStoredPublicKeyMaterial,
  loadStoredPublicKeyMaterialByKeyId,
  saveStoredPublicKey,
} from '@/services/db/storedPublicKeys.ts';

export type PrivateKeyLoginResult = {
  username: string;
  existingUser: boolean;
};

export type PrivateKeyUserLookup =
  | { status: 'known'; username: string }
  | { status: 'needsUsername' };

export async function lookupPrivateKeyUser(
  privateJwk: JsonWebKey,
): Promise<PrivateKeyUserLookup> {
  const publicJwk = slimEcPublicJwk(privateJwk);
  const keyId = await ecPublicJwkThumbprintSha256(publicJwk);
  const existingByKey = await loadStoredPublicKeyMaterialByKeyId(keyId);

  if (existingByKey?.username) {
    return { status: 'known', username: existingByKey.username };
  }

  return { status: 'needsUsername' };
}

/**
 * Resolve the username for a private-key sign-in on this device.
 * Uses the derived public key id to find an existing account, or links the key
 * to `usernameHint` when this browser has not seen the key before.
 */
export async function resolveUsernameFromPrivateKeyJwk(
  privateJwk: JsonWebKey,
  usernameHint?: string,
): Promise<PrivateKeyLoginResult> {
  const publicJwk = slimEcPublicJwk(privateJwk);
  const keyId = await ecPublicJwkThumbprintSha256(publicJwk);
  const trimmedHint = usernameHint?.trim() ?? '';

  const existingByKey = await loadStoredPublicKeyMaterialByKeyId(keyId);
  if (existingByKey?.username) {
    return { username: existingByKey.username, existingUser: true };
  }

  if (existingByKey && !trimmedHint) {
    throw new Error(
      'Enter your username to link this private key on this device.',
    );
  }

  if (!existingByKey && !trimmedHint) {
    throw new Error(
      'Enter your username to sign in with this private key on this device.',
    );
  }

  const existingByUsername = await loadStoredPublicKeyMaterial(trimmedHint);
  if (existingByUsername && existingByUsername.keyId !== keyId) {
    throw new Error(
      'That username is already linked to a different public key on this device.',
    );
  }

  if (existingByUsername) {
    return { username: trimmedHint, existingUser: true };
  }

  await saveStoredPublicKey(keyId, publicJwk, trimmedHint, true);
  return { username: trimmedHint, existingUser: false };
}
