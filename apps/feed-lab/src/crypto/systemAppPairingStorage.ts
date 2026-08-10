import {
  FEED_BRIDGE_PAIRING_STORAGE_KEY,
  FEED_BRIDGE_PENDING_PAIR_STORAGE_PREFIX,
  FEED_BRIDGE_RESULT_STORAGE_PREFIX,
  type FeedLabBridgePairing,
} from '@encrypt/core/feed/feedLabBridge';
import type { FeedBridgeEncryptedStorageRecord } from '@encrypt/core/feed/feedLabBridgeSessionCrypto';
import { getBridgeSessionKeyId } from '@lab/crypto/bridgeSessionKey.ts';

let activePairing: FeedLabBridgePairing | null = null;

/**
 * Removes all ephemeral cross-tab pairing notifications from localStorage.
 * These should never survive a page load.
 */
export function clearAllPendingPairNotifications(): void {
  const keysToRemove: string[] = [];
  for (let i = 0; i < localStorage.length; i++) {
    const key = localStorage.key(i);
    if (key?.startsWith(FEED_BRIDGE_PENDING_PAIR_STORAGE_PREFIX)) {
      keysToRemove.push(key);
    }
  }
  for (const key of keysToRemove) {
    localStorage.removeItem(key);
  }
}

export function clearPendingPairNotification(sessionId: string): void {
  try {
    localStorage.removeItem(
      `${FEED_BRIDGE_PENDING_PAIR_STORAGE_PREFIX}${sessionId}`,
    );
  } catch {
    // ignore
  }
}

export function initializeBridgePairingStorage(): void {
  clearAllPendingPairNotifications();
  try {
    sessionStorage.removeItem(FEED_BRIDGE_PAIRING_STORAGE_KEY);
  } catch {
    // ignore
  }
}

export function loadFeedLabBridgePairing(): FeedLabBridgePairing | null {
  if (!activePairing || !isFeedLabBridgePairingValid(activePairing)) {
    return null;
  }
  return activePairing;
}

export function saveFeedLabBridgePairing(pairing: FeedLabBridgePairing): void {
  activePairing = pairing;
}

export function clearFeedLabBridgePairing(): void {
  activePairing = null;
}

export function isFeedLabBridgePairingValid(
  pairing: FeedLabBridgePairing | null,
): pairing is FeedLabBridgePairing {
  if (!pairing) {
    return false;
  }
  return pairing.origin === window.location.origin;
}

export function isCompleteFeedLabBridgePairing(
  pairing: FeedLabBridgePairing | null | undefined,
): pairing is FeedLabBridgePairing {
  if (!pairing) {
    return false;
  }
  return (
    typeof pairing.sessionId === 'string' &&
    pairing.sessionId.length > 0 &&
    typeof pairing.keyId === 'string' &&
    pairing.keyId.length > 0 &&
    typeof pairing.publicKey?.x === 'string' &&
    pairing.publicKey.x.length > 0 &&
    typeof pairing.publicKey?.y === 'string' &&
    pairing.publicKey.y.length > 0 &&
    typeof pairing.origin === 'string' &&
    pairing.origin.length > 0 &&
    typeof pairing.bridgeSessionKeyId === 'string' &&
    pairing.bridgeSessionKeyId.length > 0 &&
    pairing.bridgeSessionPublicJwk !== null &&
    typeof pairing.bridgeSessionPublicJwk === 'object' &&
    'kty' in pairing.bridgeSessionPublicJwk
  );
}

export function saveFeedLabBridgePairingIfComplete(
  pairing: FeedLabBridgePairing | null | undefined,
): boolean {
  if (!isCompleteFeedLabBridgePairing(pairing)) {
    return false;
  }
  saveFeedLabBridgePairing(pairing);
  return true;
}

export type FeedLabSessionMode = 'file-key' | 'system-app';

export function getFeedLabSessionMode(): FeedLabSessionMode {
  return loadFeedLabBridgePairing() !== null ? 'system-app' : 'file-key';
}

/**
 * Removes oracle callback records encrypted for a bridge session key that is no
 * longer held in this tab's memory (after rotate or disconnect). Each entry is
 * `encrypt:bridge-result:{requestId}` with a {@link FeedBridgeEncryptedStorageRecord}
 * payload; without the matching in-tab private key those records cannot be
 * decrypted and would only block or confuse in-flight requests.
 */
export function clearBridgeResultRecordsForSessionKey(
  sessionKeyId: string,
): void {
  const keysToRemove: string[] = [];
  for (let i = 0; i < localStorage.length; i++) {
    const key = localStorage.key(i);
    if (!key?.startsWith(FEED_BRIDGE_RESULT_STORAGE_PREFIX)) {
      continue;
    }
    try {
      const raw = localStorage.getItem(key);
      if (!raw) {
        continue;
      }
      const parsed = JSON.parse(raw) as FeedBridgeEncryptedStorageRecord;
      if (parsed.sessionKeyId === sessionKeyId) {
        keysToRemove.push(key);
      }
    } catch {
      // ignore malformed entries
    }
  }
  for (const key of keysToRemove) {
    localStorage.removeItem(key);
  }
}

export function clearBridgeResultRecordsForCurrentSession(): void {
  const sessionKeyId = getBridgeSessionKeyId();
  if (sessionKeyId) {
    clearBridgeResultRecordsForSessionKey(sessionKeyId);
  }
}

export function disconnectSystemAppBridge(): void {
  clearBridgeResultRecordsForCurrentSession();
  clearFeedLabBridgePairing();
}

export type { FeedLabBridgePairing };
