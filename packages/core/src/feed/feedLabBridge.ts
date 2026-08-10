import type {
  AuthPublicKeyCoords,
  AuthRequestDescriptor,
} from '../crypto/authProof.ts';
import { bytesToBase64Url } from '../utils/bytes.ts';
import type { FeedBridgeEncryptedStorageRecord } from './feedLabBridgeSessionCrypto.ts';

/** Practical cap for JSON in a deep-link payload (OS argv / URL length limits). */
export const MAX_FEED_BRIDGE_PAYLOAD_LENGTH = 32 * 1024;

export const FEED_BRIDGE_RESULT_STORAGE_PREFIX = 'encrypt:bridge-result:';

export const FEED_BRIDGE_PAIRING_STORAGE_KEY =
  'encrypt:feed-lab-bridge-pairing';

/** Ephemeral cross-tab handoff for pairing completion (localStorage only). */
export const FEED_BRIDGE_PENDING_PAIR_STORAGE_PREFIX =
  'encrypt:bridge-pending-pair:';

export const FEED_BRIDGE_REQUEST_TIMEOUT_MS = 60_000;

/** System-app oracles — signing and ECDH only; symmetric crypto stays in feed-lab. */
export type FeedLabBridgeOracleOp = 'ecdh-agree' | 'ecdsa-sign' | 'op-quick';

export type FeedLabBridgePairing = {
  sessionId: string;
  keyId: string;
  publicKey: AuthPublicKeyCoords;
  origin: string;
  bridgeSessionKeyId: string;
  bridgeSessionPublicJwk: JsonWebKey;
};

export type FeedLabBridgeDeepLinkAction =
  | {
      type: 'feed-pair';
      origin: string;
      session: string;
      callback: string;
      bridgeSessionKeyId: string;
      bridgeSessionPublicJwk: string;
    }
  | {
      type: 'feed-op';
      session: string;
      requestId: string;
      op: FeedLabBridgeOracleOp;
      bridgeSessionKeyId: string;
      bridgeSessionPublicJwk: string;
      payload: string;
      origin: string;
      callback: string;
    };

export function feedBridgeResultStorageKey(requestId: string): string {
  return `${FEED_BRIDGE_RESULT_STORAGE_PREFIX}${requestId}`;
}

export function encodeFeedBridgePayload(value: unknown): string {
  const json = JSON.stringify(value);
  if (json.length > MAX_FEED_BRIDGE_PAYLOAD_LENGTH) {
    throw new Error(
      `Feed bridge payload exceeds the maximum length (${MAX_FEED_BRIDGE_PAYLOAD_LENGTH} characters).`,
    );
  }
  return bytesToBase64Url(new TextEncoder().encode(json));
}

export function decodeFeedBridgePayload<T>(encoded: string): T {
  if (!encoded) {
    throw new Error('Feed bridge payload is missing.');
  }
  try {
    const bytes = base64UrlToBytes(encoded);
    const json = new TextDecoder().decode(bytes);
    return JSON.parse(json) as T;
  } catch {
    throw new Error('Feed bridge payload is invalid.');
  }
}

function base64UrlToBytes(encoded: string): Uint8Array {
  const padded = encoded.replace(/-/g, '+').replace(/_/g, '/');
  const padLength = (4 - (padded.length % 4)) % 4;
  const base64 = padded + '='.repeat(padLength);
  const binary = atob(base64);
  const bytes = new Uint8Array(binary.length);
  for (let i = 0; i < binary.length; i++) {
    bytes[i] = binary.charCodeAt(i);
  }
  return bytes;
}

export function buildFeedPairDeepLink(options: {
  origin: string;
  session: string;
  callback: string;
  bridgeSessionKeyId: string;
  bridgeSessionPublicJwk: JsonWebKey;
}): string {
  const params = new URLSearchParams();
  params.set('origin', options.origin);
  params.set('session', options.session);
  params.set('callback', options.callback);
  params.set('bridgeSessionKeyId', options.bridgeSessionKeyId);
  params.set(
    'bridgeSessionPublicJwk',
    encodeFeedBridgePayload(options.bridgeSessionPublicJwk),
  );
  return `encrypt://feed-pair?${params.toString()}`;
}

export function buildFeedOpDeepLink(options: {
  session: string;
  requestId: string;
  op: FeedLabBridgeOracleOp;
  bridgeSessionKeyId: string;
  bridgeSessionPublicJwk: JsonWebKey;
  payload: unknown;
  origin: string;
  callback: string;
}): string {
  const params = new URLSearchParams();
  params.set('session', options.session);
  params.set('requestId', options.requestId);
  params.set('op', options.op);
  params.set('origin', options.origin);
  params.set('callback', options.callback);
  params.set('bridgeSessionKeyId', options.bridgeSessionKeyId);
  params.set(
    'bridgeSessionPublicJwk',
    encodeFeedBridgePayload(options.bridgeSessionPublicJwk),
  );
  params.set('payload', encodeFeedBridgePayload(options.payload));
  return `encrypt://feed-op?${params.toString()}`;
}

export function buildFeedBridgeCallbackUrl(
  baseCallbackUrl: string,
  options: {
    requestId: string;
    record: FeedBridgeEncryptedStorageRecord;
  },
): string {
  const params = new URLSearchParams();
  params.set('requestId', options.requestId);
  params.set('record', encodeFeedBridgePayload(options.record));
  const separator = baseCallbackUrl.includes('?') ? '&' : '?';
  return `${baseCallbackUrl}${separator}${params.toString()}`;
}

export type FeedLabBridgeEcdhAgreePayload = {
  peerPublicJwk: JsonWebKey;
};

export type FeedLabBridgeEcdhAgreeResult = {
  sharedSecret: string;
};

export type FeedLabBridgeEcdsaSignPayload = {
  signable: Record<string, unknown>;
};

export type FeedLabBridgeEcdsaSignResult = {
  signature: string;
};

export type FeedLabBridgeOracleRequestContext = {
  bridgeSessionKeyId: string;
  bridgeSessionPublicJwk: JsonWebKey;
};

export function isFeedLabBridgeDeepLinkAction(action: {
  type: string;
}): action is FeedLabBridgeDeepLinkAction {
  return action.type === 'feed-pair' || action.type === 'feed-op';
}

export type { AuthRequestDescriptor };
