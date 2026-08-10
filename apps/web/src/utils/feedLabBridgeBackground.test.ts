import { describe, expect, it } from 'vitest';
import {
  AUTH_SIGNABLE_VERSION,
  computeAuthTimeSlot,
  generateAuthNonce,
} from '@encrypt/core/crypto/authProof';
import { encodeFeedBridgePayload } from '@encrypt/core/feed/feedLabBridge';
import { isBackgroundFeedLabBridgeOp } from '@encrypt/core/feed/feedLabBridgeBackground';
import { FEED_BRIDGE_QUICK_OP_PAYLOAD_VERSION } from '@encrypt/core/feed/feedLabBridgeQuickOp';

function buildQuickOpAction(payload: unknown) {
  return {
    type: 'feed-op' as const,
    session: 'session-1',
    requestId: 'request-1',
    op: 'op-quick' as const,
    bridgeSessionKeyId: 'bridge-1',
    bridgeSessionPublicJwk: 'eyJrMSI6InYifQ',
    payload: encodeFeedBridgePayload(payload),
    origin: 'https://feed.example.com',
    callback: 'https://feed.example.com/bridge-callback',
  };
}

describe('isBackgroundFeedLabBridgeOp', () => {
  it('accepts validated op-quick feed-op actions', () => {
    const action = buildQuickOpAction({
      v: FEED_BRIDGE_QUICK_OP_PAYLOAD_VERSION,
      kind: 'api-auth-get',
      auth: {
        v: AUTH_SIGNABLE_VERSION,
        keyId: 'test-key-id',
        method: 'GET',
        path: '/api/inbox',
        query: null,
        timeSlot: computeAuthTimeSlot(),
        nonce: generateAuthNonce(),
      },
    });

    expect(isBackgroundFeedLabBridgeOp(action)).toBe(true);
  });

  it('rejects ecdsa-sign actions', () => {
    const action = buildQuickOpAction({});
    expect(isBackgroundFeedLabBridgeOp({ ...action, op: 'ecdsa-sign' })).toBe(
      false,
    );
  });

  it('rejects invalid op-quick payloads', () => {
    const action = buildQuickOpAction({ kind: 'api-auth-get', v: 999 });
    expect(isBackgroundFeedLabBridgeOp(action)).toBe(false);
  });
});
