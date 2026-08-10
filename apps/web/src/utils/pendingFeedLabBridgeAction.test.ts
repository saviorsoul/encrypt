import { describe, expect, it, beforeEach } from 'vitest';
import {
  PENDING_FEED_LAB_BRIDGE_ACTION_KEY,
  readPendingFeedLabBridgeAction,
  writePendingFeedLabBridgeAction,
} from '@/utils/pendingFeedLabBridgeAction.ts';

const SAMPLE_ACTION = {
  type: 'feed-op' as const,
  session: 'session-1',
  requestId: 'request-1',
  op: 'ecdsa-sign' as const,
  bridgeSessionKeyId: 'bridge-1',
  bridgeSessionPublicJwk: 'eyJrMSI6InYifQ',
  payload: 'eyJ0ZXN0IjoxfQ',
  origin: 'https://feed.example.com',
  callback: 'https://feed.example.com/bridge-callback',
};

describe('pendingFeedLabBridgeAction', () => {
  beforeEach(() => {
    sessionStorage.clear();
  });

  it('persists and reads a confirmed pending request', () => {
    writePendingFeedLabBridgeAction({
      action: SAMPLE_ACTION,
      browserPackage: 'com.example.browser',
      confirmed: true,
    });

    expect(sessionStorage.getItem(PENDING_FEED_LAB_BRIDGE_ACTION_KEY)).toBeTruthy();
    expect(readPendingFeedLabBridgeAction()).toEqual({
      action: SAMPLE_ACTION,
      browserPackage: 'com.example.browser',
      confirmed: true,
    });
  });

  it('clears a pending request', () => {
    writePendingFeedLabBridgeAction({
      action: SAMPLE_ACTION,
      browserPackage: null,
      confirmed: true,
    });
    writePendingFeedLabBridgeAction(null);
    expect(readPendingFeedLabBridgeAction()).toBeNull();
  });
});
