import type { UploadedPrivateKeyMaterial } from '../crypto/privateKeyMaterial.ts';
import {
  AUTH_HEADER_NEXT_NONCE,
  AUTH_HEADER_NEXT_NONCE_EXPIRES_AT,
  parseAuthNonceExpiresAtHeader,
  parseAuthNonceHeader,
  AUTH_NONCE_MIN_REMAINING_SECONDS,
  AUTH_NONCE_TTL_SECONDS,
  authHeadersToRecord,
  computeAuthTimeSlot,
  signAuthProof,
  type AuthRequestDescriptor,
  type AuthRequestHeaders,
} from '../crypto/authProof.ts';

export type FeedApiAuthHeaderOptions = {
  bypassClientNonceCache?: boolean;
};

export type FeedApiAuthProvider = {
  getAuthHeaders: (
    request: AuthRequestDescriptor,
    options?: FeedApiAuthHeaderOptions,
  ) => Promise<AuthRequestHeaders>;
  captureNextNonceFromResponse: (keyId: string, response: Response) => void;
};

export type FeedApiPerRequestAuth = {
  authMaterial: UploadedPrivateKeyMaterial;
};

export type FeedApiAuthProviderConfig = {
  challengeUrl: string;
  fetch?: typeof fetch;
};

type KeyNonceState = {
  pending: string | null;
  inFlightCount: number;
  waiters: Array<() => void>;
};

const NONCE_STORAGE_PREFIX = 'encrypt:feed-api-nonce:';

const keyNonceStates = new Map<string, KeyNonceState>();
const authLocks = new Map<string, Promise<void>>();

function nonceStorageKey(keyId: string): string {
  return `${NONCE_STORAGE_PREFIX}${keyId}`;
}

function getNoncePersistence(): Storage | null {
  if (typeof localStorage === 'undefined') {
    return null;
  }
  return localStorage;
}

type StoredAuthNonce = {
  nonce: string;
  expiresAt: number;
};

function nonceExpiresAtMs(): number {
  return Date.now() + AUTH_NONCE_TTL_SECONDS * 1000;
}

function nonceHasMinRemaining(expiresAt: number): boolean {
  return Date.now() + AUTH_NONCE_MIN_REMAINING_SECONDS * 1000 < expiresAt;
}

function serializeStoredNonce(nonce: string, expiresAt: number): string {
  const record: StoredAuthNonce = {
    nonce,
    expiresAt,
  };
  return JSON.stringify(record);
}

function parseStoredNonceRecord(raw: string | null): StoredAuthNonce | null {
  if (!raw?.trim()) {
    return null;
  }
  try {
    const parsed = JSON.parse(raw) as Partial<StoredAuthNonce>;
    if (
      typeof parsed.nonce === 'string' &&
      parsed.nonce &&
      typeof parsed.expiresAt === 'number'
    ) {
      return { nonce: parsed.nonce, expiresAt: parsed.expiresAt };
    }
  } catch {
    // Legacy plain nonce strings have no TTL and are not reused.
  }
  return null;
}

function parseNonceFromStorageValue(raw: string | null): string | null {
  const record = parseStoredNonceRecord(raw);
  if (!record) {
    return null;
  }
  if (!nonceHasMinRemaining(record.expiresAt)) {
    return null;
  }
  return record.nonce;
}

function readStoredPendingNonce(keyId: string): string | null {
  const storage = getNoncePersistence();
  if (!storage) {
    return null;
  }
  const key = nonceStorageKey(keyId);
  try {
    const raw = storage.getItem(key);
    const nonce = parseNonceFromStorageValue(raw);
    if (nonce) {
      return nonce;
    }
    if (raw) {
      storage.removeItem(key);
    }
    if (typeof sessionStorage !== 'undefined') {
      sessionStorage.removeItem(key);
    }
    return null;
  } catch (error) {
    console.warn('Failed to read stored auth nonce from localStorage.', error);
    return null;
  }
}

function writeStoredPendingNonce(
  keyId: string,
  nonce: string,
  expiresAt: number,
): void {
  const storage = getNoncePersistence();
  if (!storage) {
    return;
  }
  try {
    storage.setItem(
      nonceStorageKey(keyId),
      serializeStoredNonce(nonce, expiresAt),
    );
  } catch (error) {
    console.warn('Failed to write auth nonce to localStorage.', error);
  }
}

function removeStoredPendingNonce(keyId: string): void {
  const storage = getNoncePersistence();
  if (!storage) {
    return;
  }
  try {
    storage.removeItem(nonceStorageKey(keyId));
  } catch (error) {
    console.warn('Failed to remove auth nonce from localStorage.', error);
  }
}

function clearAllStoredPendingNonces(): void {
  const storage = getNoncePersistence();
  if (!storage) {
    return;
  }
  try {
    const keys: string[] = [];
    for (let index = 0; index < storage.length; index += 1) {
      const key = storage.key(index);
      if (key?.startsWith(NONCE_STORAGE_PREFIX)) {
        keys.push(key);
      }
    }
    for (const key of keys) {
      storage.removeItem(key);
    }
  } catch (error) {
    console.warn(
      'Failed to clear stored auth nonces from localStorage.',
      error,
    );
  }
}

function rememberPendingNonce(
  keyId: string,
  nonce: string,
  expiresAt = nonceExpiresAtMs(),
): void {
  getKeyNonceState(keyId).pending = nonce;
  writeStoredPendingNonce(keyId, nonce, expiresAt);
}

function syncPendingNonceFromStorage(keyId: string): string | null {
  const stored = readStoredPendingNonce(keyId);
  const state = getKeyNonceState(keyId);
  state.pending = stored;
  return stored;
}

export function handleFeedApiAuthStorageEvent(event: StorageEvent): void {
  if (!event.key?.startsWith(NONCE_STORAGE_PREFIX)) {
    return;
  }
  const keyId = event.key.slice(NONCE_STORAGE_PREFIX.length);
  const state = getKeyNonceState(keyId);
  state.pending = parseNonceFromStorageValue(event.newValue);
  notifyNonceWaiters(keyId);
}

function getKeyNonceState(keyId: string): KeyNonceState {
  let state = keyNonceStates.get(keyId);
  if (!state) {
    state = { pending: null, inFlightCount: 0, waiters: [] };
    keyNonceStates.set(keyId, state);
  }
  return state;
}

function notifyNonceWaiters(keyId: string): void {
  const state = getKeyNonceState(keyId);
  const waiters = state.waiters;
  state.waiters = [];
  for (const resolve of waiters) {
    resolve();
  }
}

function waitForInFlightNonce(keyId: string): Promise<void> {
  const state = getKeyNonceState(keyId);
  if (state.inFlightCount === 0) {
    return Promise.resolve();
  }
  return new Promise((resolve) => {
    state.waiters.push(resolve);
  });
}

function commitNonceUse(keyId: string): void {
  const state = getKeyNonceState(keyId);
  state.pending = null;
  removeStoredPendingNonce(keyId);
  state.inFlightCount += 1;
}

export function clearFeedApiAuthState(): void {
  keyNonceStates.clear();
  authLocks.clear();
  clearAllStoredPendingNonces();
}

/** Drop in-flight coordination for a key without discarding its pending rotated nonce. */
export function releaseFeedApiAuthKeySwitch(previousKeyId: string): void {
  const state = keyNonceStates.get(previousKeyId);
  if (state && state.inFlightCount > 0) {
    state.inFlightCount = 0;
    notifyNonceWaiters(previousKeyId);
  }
  authLocks.delete(previousKeyId);
}

async function withKeyAuthLock<T>(
  keyId: string,
  fn: () => Promise<T>,
): Promise<T> {
  const previous = authLocks.get(keyId) ?? Promise.resolve();
  let release!: () => void;
  const gate = new Promise<void>((resolve) => {
    release = resolve;
  });
  const chain = previous.then(() => gate);
  authLocks.set(keyId, chain);
  await previous;
  try {
    return await fn();
  } finally {
    release();
    if (authLocks.get(keyId) === chain) {
      authLocks.delete(keyId);
    }
  }
}

async function readApiError(response: Response): Promise<string> {
  try {
    const body = (await response.json()) as { error?: string };
    if (typeof body.error === 'string' && body.error) {
      return body.error;
    }
  } catch {
    // ignore JSON parse errors
  }
  return `Request failed (${response.status}).`;
}

async function requestChallengeNonce(
  config: FeedApiAuthProviderConfig,
  material: UploadedPrivateKeyMaterial,
): Promise<{ nonce: string; expiresAt: number }> {
  const http = config.fetch ?? fetch;
  const response = await http(config.challengeUrl, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      keyId: material.keyId,
    }),
  });
  if (!response.ok) {
    throw new Error(await readApiError(response));
  }
  const body = (await response.json()) as {
    nonce?: string;
    expiresAt?: number;
  };
  if (typeof body.nonce !== 'string' || !body.nonce) {
    throw new Error('Challenge response is missing a nonce.');
  }
  const expiresAt =
    typeof body.expiresAt === 'number' && Number.isFinite(body.expiresAt)
      ? body.expiresAt
      : nonceExpiresAtMs();
  return { nonce: body.nonce, expiresAt };
}

async function resolvePendingNonce(
  config: FeedApiAuthProviderConfig,
  material: UploadedPrivateKeyMaterial,
  bypassClientCache: boolean,
): Promise<string> {
  if (bypassClientCache) {
    const challenge = await requestChallengeNonce(config, material);
    rememberPendingNonce(material.keyId, challenge.nonce, challenge.expiresAt);
    return challenge.nonce;
  }

  const state = getKeyNonceState(material.keyId);
  const stored = syncPendingNonceFromStorage(material.keyId);
  if (stored) {
    return stored;
  }

  if (state.inFlightCount > 0) {
    await waitForInFlightNonce(material.keyId);
    const afterWait = syncPendingNonceFromStorage(material.keyId);
    if (afterWait) {
      return afterWait;
    }
  }

  const challenge = await requestChallengeNonce(config, material);
  rememberPendingNonce(material.keyId, challenge.nonce, challenge.expiresAt);
  return challenge.nonce;
}

export async function buildAuthHeadersFromMaterial(
  material: UploadedPrivateKeyMaterial,
  request: AuthRequestDescriptor,
  nonce: string,
  timeSlot = computeAuthTimeSlot(),
): Promise<AuthRequestHeaders> {
  const signature = await signAuthProof(
    material.ecdsaSignPrivateKey,
    material.keyId,
    { timeSlot, nonce },
    request,
  );
  return {
    keyId: material.keyId,
    publicKey: material.publicKey,
    timeSlot,
    nonce,
    signature,
  };
}

async function buildAuthHeaderRecordForMaterial(
  config: FeedApiAuthProviderConfig,
  material: UploadedPrivateKeyMaterial,
  request: AuthRequestDescriptor,
  options?: FeedApiAuthHeaderOptions,
): Promise<Record<string, string>> {
  return withKeyAuthLock(material.keyId, async () => {
    const nonce = await resolvePendingNonce(
      config,
      material,
      options?.bypassClientNonceCache === true,
    );
    commitNonceUse(material.keyId);
    const headers = await buildAuthHeadersFromMaterial(
      material,
      request,
      nonce,
    );
    return authHeadersToRecord(headers);
  });
}

export function captureFeedApiNextNonce(
  keyId: string,
  response: Response,
): void {
  const state = getKeyNonceState(keyId);
  const nextNonce = parseAuthNonceHeader(
    response.headers.get(AUTH_HEADER_NEXT_NONCE) ?? undefined,
  );
  if (nextNonce) {
    const expiresAt =
      parseAuthNonceExpiresAtHeader(
        response.headers.get(AUTH_HEADER_NEXT_NONCE_EXPIRES_AT),
      ) ?? nonceExpiresAtMs();
    rememberPendingNonce(keyId, nextNonce, expiresAt);
  }
  if (state.inFlightCount > 0) {
    state.inFlightCount -= 1;
  }
  notifyNonceWaiters(keyId);
}

export function createFeedApiAuthProvider(
  getMaterial: () => Promise<UploadedPrivateKeyMaterial | null>,
  config: FeedApiAuthProviderConfig,
): FeedApiAuthProvider {
  return {
    captureNextNonceFromResponse: captureFeedApiNextNonce,
    async getAuthHeaders(request, options) {
      const material = await getMaterial();
      if (!material) {
        throw new Error(
          'Private key is required for this API request. Unlock your identity first.',
        );
      }
      return withKeyAuthLock(material.keyId, async () => {
        const nonce = await resolvePendingNonce(
          config,
          material,
          options?.bypassClientNonceCache === true,
        );
        commitNonceUse(material.keyId);
        const headers = await buildAuthHeadersFromMaterial(
          material,
          request,
          nonce,
        );
        return headers;
      });
    },
  };
}

export async function resolveAuthHeaderRecord(
  config: FeedApiAuthProviderConfig,
  request: AuthRequestDescriptor,
  credentials: {
    auth?: FeedApiAuthProvider;
    perRequest?: FeedApiPerRequestAuth;
  },
  options?: FeedApiAuthHeaderOptions,
): Promise<Record<string, string>> {
  if (credentials.perRequest) {
    return buildAuthHeaderRecordForMaterial(
      config,
      credentials.perRequest.authMaterial,
      request,
      options,
    );
  }
  if (!credentials.auth) {
    throw new Error(
      'API authentication is not configured. Provide a private key session.',
    );
  }
  const headers = await credentials.auth.getAuthHeaders(request, options);
  return authHeadersToRecord(headers);
}

export type { AuthRequestDescriptor } from '../crypto/authProof.ts';
