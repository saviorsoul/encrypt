import type { AuthSignableGetBody } from '../crypto/authProof.ts';
import {
  AUTH_SIGNABLE_VERSION,
  isAuthTimeSlotAccepted,
  parseAuthNonceHeader,
} from '../crypto/authProof.ts';

export const FEED_BRIDGE_QUICK_OP_PAYLOAD_VERSION = 1;

export type FeedLabBridgeQuickOpKind = 'api-auth-get';

export type FeedLabBridgeQuickOpApiAuthGetPayload = {
  v: typeof FEED_BRIDGE_QUICK_OP_PAYLOAD_VERSION;
  kind: 'api-auth-get';
  auth: AuthSignableGetBody;
};

export type FeedLabBridgeQuickOpPayload = FeedLabBridgeQuickOpApiAuthGetPayload;

export type ParsedFeedLabBridgeQuickOp = {
  kind: FeedLabBridgeQuickOpKind;
  auth: AuthSignableGetBody;
};

const API_AUTH_GET_PATH_PATTERN = /^\/api\/[A-Za-z0-9/_-]+$/;

const API_AUTH_GET_AUTH_KEYS = [
  'v',
  'keyId',
  'method',
  'path',
  'query',
  'timeSlot',
  'nonce',
] as const;

const QUICK_OP_ROOT_KEYS = ['v', 'kind', 'auth'] as const;

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

function hasOnlyKeys(
  value: Record<string, unknown>,
  allowed: readonly string[],
): boolean {
  const keys = Object.keys(value);
  if (keys.length !== allowed.length) {
    return false;
  }
  return allowed.every((key) =>
    Object.prototype.hasOwnProperty.call(value, key),
  );
}

function isNonEmptyString(value: unknown): value is string {
  return typeof value === 'string' && value.length > 0;
}

function parseApiAuthQuery(
  value: unknown,
): Record<string, string> | null | undefined {
  if (value === null) {
    return null;
  }
  if (!isRecord(value)) {
    return undefined;
  }

  const query: Record<string, string> = {};
  for (const [key, entry] of Object.entries(value)) {
    if (!isNonEmptyString(key) || typeof entry !== 'string') {
      return undefined;
    }
    query[key] = entry;
  }
  return query;
}

function parseApiAuthGetAuth(value: unknown): AuthSignableGetBody | null {
  if (!isRecord(value) || !hasOnlyKeys(value, API_AUTH_GET_AUTH_KEYS)) {
    return null;
  }

  if (value.v !== AUTH_SIGNABLE_VERSION) {
    return null;
  }
  if (!isNonEmptyString(value.keyId)) {
    return null;
  }
  if (value.method !== 'GET') {
    return null;
  }
  if (
    !isNonEmptyString(value.path) ||
    !API_AUTH_GET_PATH_PATTERN.test(value.path)
  ) {
    return null;
  }

  const query = parseApiAuthQuery(value.query);
  if (query === undefined) {
    return null;
  }

  const timeSlot = value.timeSlot;
  if (
    typeof timeSlot !== 'number' ||
    !Number.isInteger(timeSlot) ||
    timeSlot < 0
  ) {
    return null;
  }
  if (!isAuthTimeSlotAccepted(timeSlot)) {
    return null;
  }

  const nonce = parseAuthNonceHeader(
    typeof value.nonce === 'string' ? value.nonce : undefined,
  );
  if (!nonce) {
    return null;
  }

  return {
    v: AUTH_SIGNABLE_VERSION,
    keyId: value.keyId,
    method: 'GET',
    path: value.path,
    query,
    timeSlot,
    nonce,
  };
}

function parseApiAuthGetPayload(
  payload: Record<string, unknown>,
): ParsedFeedLabBridgeQuickOp | null {
  if (!hasOnlyKeys(payload, QUICK_OP_ROOT_KEYS)) {
    return null;
  }
  if (payload.v !== FEED_BRIDGE_QUICK_OP_PAYLOAD_VERSION) {
    return null;
  }
  if (payload.kind !== 'api-auth-get') {
    return null;
  }

  const auth = parseApiAuthGetAuth(payload.auth);
  if (!auth) {
    return null;
  }

  return { kind: 'api-auth-get', auth };
}

const QUICK_OP_PARSERS: Record<
  FeedLabBridgeQuickOpKind,
  (payload: Record<string, unknown>) => ParsedFeedLabBridgeQuickOp | null
> = {
  'api-auth-get': parseApiAuthGetPayload,
};

export function parseFeedLabBridgeQuickOpPayload(
  payload: unknown,
): ParsedFeedLabBridgeQuickOp | null {
  if (!isRecord(payload)) {
    return null;
  }

  const kind = payload.kind;
  if (typeof kind !== 'string' || !(kind in QUICK_OP_PARSERS)) {
    return null;
  }

  return QUICK_OP_PARSERS[kind as FeedLabBridgeQuickOpKind](payload);
}

export function isAutoApprovableFeedLabBridgeQuickOp(
  payload: unknown,
): payload is FeedLabBridgeQuickOpPayload {
  return parseFeedLabBridgeQuickOpPayload(payload) !== null;
}

export function quickOpPayloadToSignable(
  parsed: ParsedFeedLabBridgeQuickOp,
): AuthSignableGetBody {
  return parsed.auth;
}

export function buildFeedLabBridgeQuickOpApiAuthGetPayload(
  auth: AuthSignableGetBody,
): FeedLabBridgeQuickOpApiAuthGetPayload {
  if (auth.method !== 'GET') {
    throw new Error('op-quick api-auth-get requires a GET auth signable.');
  }
  if (auth.v !== AUTH_SIGNABLE_VERSION) {
    throw new Error(
      'op-quick api-auth-get requires the current auth signable version.',
    );
  }
  if (!API_AUTH_GET_PATH_PATTERN.test(auth.path)) {
    throw new Error('op-quick api-auth-get path is not allowed.');
  }
  if (parseAuthNonceHeader(auth.nonce) === null) {
    throw new Error('op-quick api-auth-get nonce is invalid.');
  }
  if (!isAuthTimeSlotAccepted(auth.timeSlot)) {
    throw new Error(
      'op-quick api-auth-get time slot is outside the accepted window.',
    );
  }

  return {
    v: FEED_BRIDGE_QUICK_OP_PAYLOAD_VERSION,
    kind: 'api-auth-get',
    auth: {
      v: auth.v,
      keyId: auth.keyId,
      method: 'GET',
      path: auth.path,
      query: auth.query ?? null,
      timeSlot: auth.timeSlot,
      nonce: auth.nonce,
    },
  };
}
