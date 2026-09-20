import { importPublicKeyExtractable } from '@encrypt/core/crypto/ecdhKeys';
import {
  ecPublicJwkThumbprintSha256,
  slimEcPublicJwk,
} from '@encrypt/core/crypto/jwkThumbprint';
import type { ManifestRecipientKeys } from '@encrypt/core/types/manifest';

const STORAGE_KEY_PREFIX = 'feednt-stored-users:';

export type FeedntStoredUser = {
  keyId: string;
  username: string;
  publicJwk: JsonWebKey;
  acceptedInvitationToken?: string;
};

function storageKeyForOwner(ownerKeyId: string): string {
  return `${STORAGE_KEY_PREFIX}${ownerKeyId}`;
}

function parseStoredUser(value: unknown): FeedntStoredUser | null {
  if (
    typeof value !== 'object' ||
    value === null ||
    typeof (value as { keyId?: unknown }).keyId !== 'string' ||
    typeof (value as { username?: unknown }).username !== 'string'
  ) {
    return null;
  }

  const record = value as {
    keyId: string;
    username: string;
    publicJwk?: unknown;
    acceptedInvitationToken?: unknown;
  };

  if (
    typeof record.publicJwk !== 'object' ||
    record.publicJwk === null ||
    typeof (record.publicJwk as { x?: unknown }).x !== 'string' ||
    typeof (record.publicJwk as { y?: unknown }).y !== 'string'
  ) {
    return null;
  }

  try {
    const user: FeedntStoredUser = {
      keyId: record.keyId,
      username: record.username,
      publicJwk: slimEcPublicJwk(record.publicJwk as JsonWebKey),
    };
    if (typeof record.acceptedInvitationToken === 'string') {
      user.acceptedInvitationToken = record.acceptedInvitationToken;
    }
    return user;
  } catch {
    return null;
  }
}

function readStoredUsers(ownerKeyId: string): FeedntStoredUser[] {
  try {
    if (typeof localStorage === 'undefined') {
      return [];
    }
    const raw = localStorage.getItem(storageKeyForOwner(ownerKeyId));
    if (!raw) {
      return [];
    }
    const parsed: unknown = JSON.parse(raw);
    if (!Array.isArray(parsed)) {
      return [];
    }
    return parsed
      .map(parseStoredUser)
      .filter((row): row is FeedntStoredUser => row !== null)
      .sort((a, b) => a.username.localeCompare(b.username));
  } catch {
    return [];
  }
}

function writeStoredUsers(ownerKeyId: string, users: FeedntStoredUser[]): void {
  if (typeof localStorage === 'undefined') {
    return;
  }
  try {
    const key = storageKeyForOwner(ownerKeyId);
    if (users.length === 0) {
      localStorage.removeItem(key);
      return;
    }
    localStorage.setItem(
      key,
      JSON.stringify(
        users.sort((a, b) => a.username.localeCompare(b.username)),
      ),
    );
  } catch {
    /* ignore quota / privacy mode */
  }
}

export type SaveFeedntUserOptions = {
  acceptedInvitationToken?: string;
};

export async function saveFeedntUser(
  ownerKeyId: string,
  username: string,
  publicJwk: JsonWebKey,
  options?: SaveFeedntUserOptions,
): Promise<string> {
  const slimJwk = slimEcPublicJwk(publicJwk);
  const keyId = await ecPublicJwkThumbprintSha256(slimJwk);
  const users = readStoredUsers(ownerKeyId);
  const existing = users.find((user) => user.keyId === keyId);

  const usernameConflict = users.find(
    (user) => user.username === username && user.keyId !== keyId,
  );
  if (usernameConflict) {
    throw new Error('Username already taken.');
  }

  const record: FeedntStoredUser = {
    keyId,
    username,
    publicJwk: slimJwk,
    ...(options?.acceptedInvitationToken
      ? { acceptedInvitationToken: options.acceptedInvitationToken }
      : existing?.acceptedInvitationToken
        ? { acceptedInvitationToken: existing.acceptedInvitationToken }
        : {}),
  };

  const nextUsers = users.filter((user) => user.keyId !== keyId);
  nextUsers.push(record);
  writeStoredUsers(ownerKeyId, nextUsers);

  return keyId;
}

export async function listFeedntStoredUsers(
  ownerKeyId: string,
): Promise<FeedntStoredUser[]> {
  return readStoredUsers(ownerKeyId);
}

export async function loadFeedntUserByKeyId(
  ownerKeyId: string,
  keyId: string,
): Promise<FeedntStoredUser | null> {
  return (
    readStoredUsers(ownerKeyId).find((user) => user.keyId === keyId) ?? null
  );
}

export async function loadFeedntUserByUsername(
  ownerKeyId: string,
  username: string,
): Promise<FeedntStoredUser | null> {
  return (
    readStoredUsers(ownerKeyId).find((user) => user.username === username) ??
    null
  );
}

export async function loadRecipientKeysForUsername(
  ownerKeyId: string,
  username: string,
): Promise<ManifestRecipientKeys | null> {
  const stored = await loadFeedntUserByUsername(ownerKeyId, username);

  if (!stored) {
    return null;
  }

  const publicKey = await importPublicKeyExtractable(stored.publicJwk);
  return { keyId: stored.keyId, publicKey };
}

export function clearFeedntStoredUsers(ownerKeyId: string): void {
  writeStoredUsers(ownerKeyId, []);
}
