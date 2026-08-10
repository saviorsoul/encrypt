import { describe, expect, it } from 'vitest';
import {
  AUTH_SIGNABLE_VERSION,
  computeAuthTimeSlot,
  generateAuthNonce,
} from '@encrypt/core/crypto/authProof';
import {
  buildFeedLabBridgeQuickOpApiAuthGetPayload,
  FEED_BRIDGE_QUICK_OP_PAYLOAD_VERSION,
  isAutoApprovableFeedLabBridgeQuickOp,
  parseFeedLabBridgeQuickOpPayload,
} from '@encrypt/core/feed/feedLabBridgeQuickOp';

const TEST_KEY_ID = 'test-key-id';

function buildValidQuickOpPayload(
  overrides: {
    root?: Record<string, unknown>;
    auth?: Record<string, unknown>;
  } = {},
) {
  return {
    v: FEED_BRIDGE_QUICK_OP_PAYLOAD_VERSION,
    kind: 'api-auth-get',
    auth: {
      v: AUTH_SIGNABLE_VERSION,
      keyId: TEST_KEY_ID,
      method: 'GET',
      path: '/api/inbox',
      query: null,
      timeSlot: computeAuthTimeSlot(),
      nonce: generateAuthNonce(),
      ...overrides.auth,
    },
    ...overrides.root,
  };
}

describe('feedLabBridgeQuickOp', () => {
  it('parses a valid api-auth-get payload', () => {
    const payload = buildValidQuickOpPayload();
    expect(parseFeedLabBridgeQuickOpPayload(payload)).toEqual({
      kind: 'api-auth-get',
      auth: payload.auth,
    });
    expect(isAutoApprovableFeedLabBridgeQuickOp(payload)).toBe(true);
  });

  it('rejects payloads with extra root keys', () => {
    const payload = buildValidQuickOpPayload({
      root: { extra: 'field' },
    });
    expect(parseFeedLabBridgeQuickOpPayload(payload)).toBeNull();
  });

  it('rejects payloads with extra auth keys', () => {
    const payload = buildValidQuickOpPayload({
      auth: { bodyHash: 'smuggled' },
    });
    expect(parseFeedLabBridgeQuickOpPayload(payload)).toBeNull();
  });

  it('rejects non-GET methods', () => {
    const payload = buildValidQuickOpPayload({
      auth: { method: 'HEAD' },
    });
    expect(parseFeedLabBridgeQuickOpPayload(payload)).toBeNull();
  });

  it('rejects POST-style paths outside /api', () => {
    const payload = buildValidQuickOpPayload({
      auth: { path: '/health' },
    });
    expect(parseFeedLabBridgeQuickOpPayload(payload)).toBeNull();
  });

  it('rejects invalid nonces', () => {
    const payload = buildValidQuickOpPayload({
      auth: { nonce: 'not-a-nonce' },
    });
    expect(parseFeedLabBridgeQuickOpPayload(payload)).toBeNull();
  });

  it('rejects unknown quick-op kinds', () => {
    const payload = buildValidQuickOpPayload({
      root: { kind: 'future-kind' },
    });
    expect(parseFeedLabBridgeQuickOpPayload(payload)).toBeNull();
  });

  it('builds a strict api-auth-get payload from a GET signable', () => {
    const signable = buildValidQuickOpPayload().auth;
    expect(buildFeedLabBridgeQuickOpApiAuthGetPayload(signable)).toEqual({
      v: FEED_BRIDGE_QUICK_OP_PAYLOAD_VERSION,
      kind: 'api-auth-get',
      auth: signable,
    });
  });
});
