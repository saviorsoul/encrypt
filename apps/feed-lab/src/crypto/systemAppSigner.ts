import {
  FEED_LAB_PROTOCOL_BRIDGE_DISABLED_MESSAGE,
  isFeedLabProtocolBridgeEnabled,
} from '@encrypt/core/feed/feedLabBridgeConfig';
import {
  buildFeedOpDeepLink,
  buildFeedPairDeepLink,
  decodeFeedBridgePayload,
  FEED_BRIDGE_PENDING_PAIR_STORAGE_PREFIX,
  FEED_BRIDGE_REQUEST_TIMEOUT_MS,
  feedBridgeResultStorageKey,
  type FeedLabBridgeOracleOp,
  type FeedLabBridgePairing,
} from '@encrypt/core/feed/feedLabBridge';
import type { AuthPublicKeyCoords } from '@encrypt/core/crypto/authProof';
import {
  decryptFeedBridgeSessionPayload,
  type FeedBridgeEncryptedStorageRecord,
} from '@encrypt/core/feed/feedLabBridgeSessionCrypto';
import {
  buildFeedLabBridgeCallbackBaseUrl,
  buildFeedLabPairCallbackBaseUrl,
} from '@lab/lib/bridgeCallbackUrl.ts';
import {
  clearFeedLabBridgePairing,
  clearPendingPairNotification,
  disconnectSystemAppBridge,
  loadFeedLabBridgePairing,
  saveFeedLabBridgePairingIfComplete,
} from '@lab/crypto/systemAppPairingStorage.ts';
import {
  broadcastOpResult,
  broadcastPairResult,
  subscribeBridgeChannel,
  type BridgeChannelMessage,
} from '@lab/crypto/bridgeChannel.ts';
import {
  createBridgeSessionKey,
  getBridgeSessionKeyId,
  getBridgeSessionPrivateKey,
  getBridgeSessionPublicJwk,
  requireBridgeSessionKey,
  clearBridgeSessionKey,
} from '@lab/crypto/bridgeSessionKey.ts';
import {
  clearEncryptDeepLinkSilentOpenAllowed,
  ENCRYPT_APP_DEEP_LINK_CANCELLED_ERROR,
  markEncryptDeepLinkSilentOpenAllowed,
  openEncryptDeepLink,
} from '@lab/lib/encryptAppDeepLinkGate.ts';

const BRIDGE_POLL_MS = 400;

const PAIR_CANCELLED_ERROR = 'Encrypt app pairing was cancelled.';
const OP_CANCELLED_ERROR = 'Encrypt app request was cancelled.';
const FEED_LAB_PAIR_CANCELLED_ERROR = 'Feed Lab pairing was cancelled.';
const FEED_LAB_REQUEST_CANCELLED_ERROR = 'Feed Lab request was cancelled.';

function rejectIfProtocolBridgeDisabled(): void {
  if (!isFeedLabProtocolBridgeEnabled()) {
    throw new Error(FEED_LAB_PROTOCOL_BRIDGE_DISABLED_MESSAGE);
  }
}

export function isBridgeCancellationError(error: unknown): boolean {
  const message = error instanceof Error ? error.message : String(error);
  return (
    message === PAIR_CANCELLED_ERROR ||
    message === OP_CANCELLED_ERROR ||
    message === FEED_LAB_PAIR_CANCELLED_ERROR ||
    message === FEED_LAB_REQUEST_CANCELLED_ERROR ||
    message === ENCRYPT_APP_DEEP_LINK_CANCELLED_ERROR
  );
}

function markBridgeCancellationAsHandled<T>(promise: Promise<T>): Promise<T> {
  promise.catch((error) => {
    if (isBridgeCancellationError(error)) {
      return;
    }
    throw error;
  });
  return promise;
}

function pendingPairStorageKey(sessionId: string): string {
  return `${FEED_BRIDGE_PENDING_PAIR_STORAGE_PREFIX}${sessionId}`;
}

type PendingBridgeRequest = {
  requestId: string;
  resolve: (value: unknown) => void;
  reject: (error: Error) => void;
  timeoutId: ReturnType<typeof setTimeout>;
  settled: boolean;
};

const pendingByRequestId = new Map<string, PendingBridgeRequest>();
let bridgeWorkGeneration = 0;

type BridgeFlight = {
  id: string;
  kind: 'pair' | 'op';
  generation: number;
  deepLink: string;
  runAfterLaunch: () => void;
  reject: (error: Error) => void;
  cleanup: () => void;
};

const bridgeFlightQueue: BridgeFlight[] = [];
let activeBridgeFlight: BridgeFlight | null = null;
let processingBridgeFlights = false;

function completeBridgeFlight(flightId: string): void {
  if (activeBridgeFlight?.id !== flightId) {
    return;
  }
  activeBridgeFlight = null;
  void processBridgeFlightQueue();
}

function cancelQueuedBridgeFlights(error: Error): void {
  const queued = bridgeFlightQueue.splice(0);
  for (const flight of queued) {
    flight.cleanup();
    flight.reject(error);
  }
}

function enqueueBridgeFlight(flight: BridgeFlight): void {
  bridgeFlightQueue.push(flight);
  void processBridgeFlightQueue();
}

async function processBridgeFlightQueue(): Promise<void> {
  if (processingBridgeFlights || activeBridgeFlight) {
    return;
  }

  processingBridgeFlights = true;
  try {
    while (!activeBridgeFlight && bridgeFlightQueue.length > 0) {
      const flight = bridgeFlightQueue.shift();
      if (!flight) {
        break;
      }

      if (isBridgeWorkStale(flight.generation)) {
        flight.cleanup();
        flight.reject(
          new Error(
            flight.kind === 'pair' ? PAIR_CANCELLED_ERROR : OP_CANCELLED_ERROR,
          ),
        );
        continue;
      }

      activeBridgeFlight = flight;
      try {
        await openEncryptDeepLink(flight.deepLink);
      } catch (error) {
        activeBridgeFlight = null;
        flight.cleanup();
        flight.reject(
          error instanceof Error
            ? error
            : new Error('Failed to open the Encrypt app.'),
        );
        continue;
      }

      if (isBridgeWorkStale(flight.generation)) {
        activeBridgeFlight = null;
        flight.cleanup();
        flight.reject(
          new Error(
            flight.kind === 'pair' ? PAIR_CANCELLED_ERROR : OP_CANCELLED_ERROR,
          ),
        );
        continue;
      }

      flight.runAfterLaunch();
      break;
    }
  } finally {
    processingBridgeFlights = false;
  }
}

function isBridgePairingActiveOrQueued(): boolean {
  if (pendingPair) {
    return true;
  }
  if (activeBridgeFlight?.kind === 'pair') {
    return true;
  }
  return bridgeFlightQueue.some((flight) => flight.kind === 'pair');
}

/** Test helper: reset the in-memory bridge flight queue. */
export function resetBridgeFlightStateForTests(): void {
  bridgeFlightQueue.length = 0;
  activeBridgeFlight = null;
  processingBridgeFlights = false;
}

let pendingPair: {
  sessionId: string;
  resolve: (pairing: FeedLabBridgePairing) => void;
  reject: (error: Error) => void;
  timeoutId: ReturnType<typeof setTimeout>;
} | null = null;

function createRequestId(): string {
  if (typeof crypto.randomUUID === 'function') {
    return crypto.randomUUID();
  }
  return `${Date.now()}-${Math.random().toString(36).slice(2)}`;
}

function settlePendingRequest(
  pending: PendingBridgeRequest,
  result: { ok: true; value: unknown } | { ok: false; error: Error },
): void {
  if (pending.settled) {
    return;
  }
  pending.settled = true;
  clearTimeout(pending.timeoutId);
  pendingByRequestId.delete(pending.requestId);
  completeBridgeFlight(pending.requestId);
  if (result.ok) {
    markEncryptDeepLinkSilentOpenAllowed();
    pending.resolve(result.value);
    return;
  }
  pending.reject(result.error);
}

function deliverBridgeResult(
  requestId: string,
  record: FeedBridgeEncryptedStorageRecord,
): void {
  const pending = pendingByRequestId.get(requestId);
  if (!pending) {
    return;
  }

  if (record.error) {
    settlePendingRequest(pending, {
      ok: false,
      error: new Error(record.error),
    });
    return;
  }

  void decryptBridgeStorageRecord<unknown>(record)
    .then((decoded) => {
      settlePendingRequest(pending, { ok: true, value: decoded });
    })
    .catch((error) => {
      settlePendingRequest(pending, {
        ok: false,
        error:
          error instanceof Error
            ? error
            : new Error('Failed to read Encrypt app response.'),
      });
    });
}

async function decryptBridgeStorageRecord<T>(
  record: FeedBridgeEncryptedStorageRecord,
): Promise<T> {
  if (record.error) {
    throw new Error(record.error);
  }
  if (!record.envelope) {
    throw new Error('Encrypt app returned an empty result.');
  }
  const privateKey = getBridgeSessionPrivateKey();
  if (!privateKey) {
    throw new Error(
      'Bridge session key is not available in this tab. Reconnect the Encrypt app.',
    );
  }
  if (record.sessionKeyId !== getBridgeSessionKeyId()) {
    throw new Error(
      'Bridge session key changed. Reconnect the Encrypt app and try again.',
    );
  }
  return decryptFeedBridgeSessionPayload<T>(privateKey, record.envelope);
}

export function getSystemAppPairing(): FeedLabBridgePairing | null {
  return loadFeedLabBridgePairing();
}

export function disconnectSystemApp(): void {
  disconnectSystemAppBridge();
  clearBridgeSessionKey();
  clearEncryptDeepLinkSilentOpenAllowed();
}

export function isSystemAppPaired(): boolean {
  return loadFeedLabBridgePairing() !== null;
}

type PendingPairNotification = {
  sessionId: string;
  pairing?: FeedLabBridgePairing;
  error?: string;
};

function bridgeSessionPublicJwkHasKty(
  jwk: JsonWebKey | null | undefined,
): boolean {
  return Boolean(jwk && typeof jwk === 'object' && 'kty' in jwk);
}

function mergeLocalBridgeSessionIntoPairing(
  pairing: FeedLabBridgePairing,
): FeedLabBridgePairing {
  if (
    pairing.bridgeSessionKeyId &&
    bridgeSessionPublicJwkHasKty(pairing.bridgeSessionPublicJwk)
  ) {
    return pairing;
  }

  const sessionKeyId = getBridgeSessionKeyId();
  const publicJwk = getBridgeSessionPublicJwk();
  if (sessionKeyId && publicJwk && bridgeSessionPublicJwkHasKty(publicJwk)) {
    return {
      ...pairing,
      bridgeSessionKeyId: sessionKeyId,
      bridgeSessionPublicJwk: publicJwk,
    };
  }

  return pairing;
}

function completePendingPairFromNotification(
  parsed: PendingPairNotification,
): void {
  const isComplete = Boolean(parsed.pairing || parsed.error);

  if (!pendingPair || pendingPair.sessionId !== parsed.sessionId) {
    if (isComplete) {
      clearPendingPairNotification(parsed.sessionId);
    }
    return;
  }
  if (!isComplete) {
    return;
  }

  clearTimeout(pendingPair.timeoutId);
  const { resolve, reject } = pendingPair;
  const sessionId = parsed.sessionId;
  pendingPair = null;
  completeBridgeFlight(sessionId);

  clearPendingPairNotification(sessionId);

  if (parsed.error) {
    reject(new Error(parsed.error));
    return;
  }
  if (!parsed.pairing) {
    reject(new Error('Encrypt app returned an empty pairing result.'));
    return;
  }
  const pairing = mergeLocalBridgeSessionIntoPairing(parsed.pairing);
  if (!saveFeedLabBridgePairingIfComplete(pairing)) {
    reject(new Error('Encrypt app returned an incomplete pairing result.'));
    return;
  }
  markEncryptDeepLinkSilentOpenAllowed();
  resolve(pairing);
}

function deliverOpResultFromStorage(
  requestId: string,
  record: FeedBridgeEncryptedStorageRecord,
): void {
  try {
    localStorage.removeItem(feedBridgeResultStorageKey(requestId));
  } catch {
    // ignore
  }
  deliverBridgeResult(requestId, record);
}

function startPairingWatchers(sessionId: string): Array<() => void> {
  const stopPoll = window.setInterval(() => {
    try {
      const raw = localStorage.getItem(pendingPairStorageKey(sessionId));
      if (!raw) {
        return;
      }
      const parsed = JSON.parse(raw) as PendingPairNotification;
      if (!parsed.pairing && !parsed.error) {
        return;
      }
      completePendingPairFromNotification(parsed);
    } catch {
      // ignore corrupt storage
    }
  }, BRIDGE_POLL_MS);

  const stopChannel = subscribeBridgeChannelForPair(sessionId);

  return [() => window.clearInterval(stopPoll), stopChannel];
}

function subscribeBridgeChannelForPair(sessionId: string): () => void {
  return subscribeBridgeChannel((message) => {
    if (message.type !== 'pair' || message.sessionId !== sessionId) {
      return;
    }
    completePendingPairFromNotification(message);
  });
}

function subscribeBridgeChannelForOp(requestId: string): () => void {
  return subscribeBridgeChannel((message) => {
    if (message.type !== 'op' || message.requestId !== requestId) {
      return;
    }
    deliverOpResultFromStorage(requestId, message.record);
  });
}

function startOpResultWatchers(requestId: string): Array<() => void> {
  const storageKey = feedBridgeResultStorageKey(requestId);
  const stopPoll = window.setInterval(() => {
    try {
      const raw = localStorage.getItem(storageKey);
      if (!raw) {
        return;
      }
      const parsed = JSON.parse(raw) as FeedBridgeEncryptedStorageRecord;
      deliverOpResultFromStorage(requestId, parsed);
    } catch {
      // ignore corrupt storage
    }
  }, BRIDGE_POLL_MS);

  const stopChannel = subscribeBridgeChannelForOp(requestId);

  return [() => window.clearInterval(stopPoll), stopChannel];
}

export function handleBridgeChannelMessage(
  message: BridgeChannelMessage,
): void {
  if (message.type === 'pair') {
    completePendingPairFromNotification(message);
    return;
  }
  deliverOpResultFromStorage(message.requestId, message.record);
}

export function handleBridgeStorageEvent(event: StorageEvent): void {
  if (event.key?.startsWith(FEED_BRIDGE_PENDING_PAIR_STORAGE_PREFIX)) {
    if (!event.newValue) {
      return;
    }
    try {
      const parsed = JSON.parse(event.newValue) as PendingPairNotification;
      completePendingPairFromNotification(parsed);
    } catch (error) {
      if (pendingPair) {
        clearTimeout(pendingPair.timeoutId);
        const sessionId = pendingPair.sessionId;
        pendingPair.reject(
          error instanceof Error
            ? error
            : new Error('Failed to read Encrypt app pairing response.'),
        );
        pendingPair = null;
        completeBridgeFlight(sessionId);
      }
    }
    return;
  }

  if (!event.key?.startsWith('encrypt:bridge-result:')) {
    return;
  }

  const requestId = event.key.slice('encrypt:bridge-result:'.length);
  if (!event.newValue) {
    return;
  }

  try {
    const parsed = JSON.parse(
      event.newValue,
    ) as FeedBridgeEncryptedStorageRecord;
    try {
      localStorage.removeItem(event.key);
    } catch {
      // ignore
    }
    deliverOpResultFromStorage(requestId, parsed);
  } catch (error) {
    const pending = pendingByRequestId.get(requestId);
    if (!pending) {
      return;
    }
    settlePendingRequest(pending, {
      ok: false,
      error:
        error instanceof Error
          ? error
          : new Error('Failed to read Encrypt app response.'),
    });
  }
}

export function handlePairCallback(params: {
  session: string;
  keyId: string;
  publicKey: AuthPublicKeyCoords;
  bridgeSessionKeyId?: string;
  bridgeSessionPublicJwk?: JsonWebKey;
  error?: string;
}): void {
  const pairing: FeedLabBridgePairing | undefined = params.error
    ? undefined
    : mergeLocalBridgeSessionIntoPairing({
        sessionId: params.session,
        keyId: params.keyId,
        publicKey: params.publicKey,
        origin: window.location.origin,
        bridgeSessionKeyId:
          getBridgeSessionKeyId() ?? params.bridgeSessionKeyId ?? '',
        bridgeSessionPublicJwk:
          getBridgeSessionPublicJwk() ?? params.bridgeSessionPublicJwk ?? {},
      });

  if (pendingPair?.sessionId === params.session) {
    clearTimeout(pendingPair.timeoutId);
    const { resolve, reject } = pendingPair;
    pendingPair = null;
    completeBridgeFlight(params.session);
    if (params.error) {
      reject(new Error(params.error));
      return;
    }
    if (!pairing?.keyId || !pairing.publicKey.x || !pairing.publicKey.y) {
      reject(new Error('Encrypt app returned an incomplete pairing result.'));
      return;
    }
    if (!saveFeedLabBridgePairingIfComplete(pairing)) {
      reject(new Error('Bridge session key is missing. Try pairing again.'));
      return;
    }
    markEncryptDeepLinkSilentOpenAllowed();
    resolve(pairing);
    return;
  }

  const notification = {
    sessionId: params.session,
    pairing,
    error: params.error,
  };

  localStorage.setItem(
    pendingPairStorageKey(params.session),
    JSON.stringify(notification),
  );
  broadcastPairResult(notification);
}

export function abortPendingBridgeWork(): void {
  bridgeWorkGeneration += 1;
  cancelQueuedBridgeFlights(new Error(OP_CANCELLED_ERROR));
  cancelPendingSystemOps();
  cancelPendingPair();
}

function isBridgeWorkStale(generation: number): boolean {
  return generation !== bridgeWorkGeneration;
}

export function cancelPendingPair(): void {
  if (!pendingPair) {
    return;
  }
  const sessionId = pendingPair.sessionId;
  clearTimeout(pendingPair.timeoutId);
  pendingPair.reject(new Error(PAIR_CANCELLED_ERROR));
  pendingPair = null;
  completeBridgeFlight(sessionId);
  clearPendingPairNotification(sessionId);
}

export async function pairWithSystemApp(): Promise<FeedLabBridgePairing> {
  rejectIfProtocolBridgeDisabled();

  if (isBridgePairingActiveOrQueued()) {
    return Promise.reject(new Error('Pairing is already in progress.'));
  }

  const bridgeSession = await createBridgeSessionKey();
  const sessionId = createRequestId();
  const callback = buildFeedLabPairCallbackBaseUrl();
  const deepLink = buildFeedPairDeepLink({
    origin: window.location.origin,
    session: sessionId,
    callback,
    bridgeSessionKeyId: bridgeSession.sessionKeyId,
    bridgeSessionPublicJwk: bridgeSession.publicJwk,
  });

  return markBridgeCancellationAsHandled(
    new Promise<FeedLabBridgePairing>((resolve, reject) => {
      let stopWatchers: Array<() => void> = [];
      let timeoutId: ReturnType<typeof setTimeout> | null = null;

      const cleanup = () => {
        for (const stop of stopWatchers) {
          stop();
        }
        stopWatchers = [];
      };

      const clearPairTimeout = () => {
        if (timeoutId) {
          clearTimeout(timeoutId);
          timeoutId = null;
        }
      };

      enqueueBridgeFlight({
        id: sessionId,
        kind: 'pair',
        generation: bridgeWorkGeneration,
        deepLink,
        cleanup,
        reject: (error) => {
          clearPairTimeout();
          cleanup();
          clearPendingPairNotification(sessionId);
          completeBridgeFlight(sessionId);
          reject(error);
        },
        runAfterLaunch: () => {
          timeoutId = setTimeout(() => {
            if (pendingPair?.sessionId === sessionId) {
              pendingPair = null;
              cleanup();
              clearPendingPairNotification(sessionId);
              completeBridgeFlight(sessionId);
              reject(new Error('Encrypt app pairing timed out.'));
            }
          }, FEED_BRIDGE_REQUEST_TIMEOUT_MS);

          pendingPair = {
            sessionId,
            resolve: (pairing) => {
              clearPairTimeout();
              cleanup();
              clearPendingPairNotification(sessionId);
              resolve(pairing);
            },
            reject: (error) => {
              clearPairTimeout();
              cleanup();
              reject(error);
            },
            timeoutId: timeoutId!,
          };
          stopWatchers = startPairingWatchers(sessionId);
        },
      });
    }),
  );
}

export async function requestBridgeOracle<T>(
  op: FeedLabBridgeOracleOp,
  payload: unknown,
): Promise<T> {
  rejectIfProtocolBridgeDisabled();

  const pairing = loadFeedLabBridgePairing();
  if (!pairing) {
    return Promise.reject(
      new Error('Encrypt app is not paired. Connect the Encrypt app first.'),
    );
  }

  let bridgeSession;
  try {
    bridgeSession = requireBridgeSessionKey(pairing.bridgeSessionKeyId);
  } catch (error) {
    disconnectSystemApp();
    return Promise.reject(error);
  }

  const requestId = createRequestId();
  const callback = buildFeedLabBridgeCallbackBaseUrl();
  const deepLink = buildFeedOpDeepLink({
    session: pairing.sessionId,
    requestId,
    op,
    bridgeSessionKeyId: bridgeSession.sessionKeyId,
    bridgeSessionPublicJwk: bridgeSession.publicJwk,
    payload,
    origin: pairing.origin,
    callback,
  });

  return markBridgeCancellationAsHandled(
    new Promise<T>((resolve, reject) => {
      let stopWatchers: Array<() => void> = [];
      let timeoutId: ReturnType<typeof setTimeout> | null = null;

      const cleanup = () => {
        for (const stop of stopWatchers) {
          stop();
        }
        stopWatchers = [];
      };

      const clearRequestTimeout = () => {
        if (timeoutId) {
          clearTimeout(timeoutId);
          timeoutId = null;
        }
      };

      enqueueBridgeFlight({
        id: requestId,
        kind: 'op',
        generation: bridgeWorkGeneration,
        deepLink,
        cleanup,
        reject: (error) => {
          clearRequestTimeout();
          cleanup();
          completeBridgeFlight(requestId);
          reject(error);
        },
        runAfterLaunch: () => {
          timeoutId = setTimeout(() => {
            const pending = pendingByRequestId.get(requestId);
            if (pending && !pending.settled) {
              cleanup();
              settlePendingRequest(pending, {
                ok: false,
                error: new Error('Encrypt app request timed out.'),
              });
            }
          }, FEED_BRIDGE_REQUEST_TIMEOUT_MS);

          pendingByRequestId.set(requestId, {
            requestId,
            resolve: (value) => {
              clearRequestTimeout();
              cleanup();
              resolve(value as T);
            },
            reject: (error) => {
              clearRequestTimeout();
              cleanup();
              reject(error);
            },
            timeoutId: timeoutId!,
            settled: false,
          });

          stopWatchers = startOpResultWatchers(requestId);
        },
      });
    }),
  );
}

export function cancelPendingSystemOps(): void {
  for (const [, pending] of pendingByRequestId) {
    settlePendingRequest(pending, {
      ok: false,
      error: new Error(OP_CANCELLED_ERROR),
    });
  }
}

export function writeBridgeResultToStorage(
  requestId: string,
  record: FeedBridgeEncryptedStorageRecord,
): void {
  const storageKey = feedBridgeResultStorageKey(requestId);
  localStorage.setItem(storageKey, JSON.stringify(record));
  broadcastOpResult({ requestId, record });
  // Same-tab writes do not emit storage events; deliver directly.
  deliverBridgeResult(requestId, record);
}

export function parseBridgeCallbackRecord(
  encoded: string,
): FeedBridgeEncryptedStorageRecord {
  return decodeFeedBridgePayload<FeedBridgeEncryptedStorageRecord>(encoded);
}

export { clearFeedLabBridgePairing };
