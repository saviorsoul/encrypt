import process from 'node:process';
import { afterEach, describe, expect, it } from 'vitest';
import {
  getFeedLabBridgeConfig,
  isFeedLabProtocolBridgeEnabled,
  resetFeedLabBridgeConfigForTests,
} from '../../../electron/feedLabBridgeConfig.js';

describe('feedLabBridgeConfig protocol bridge flag', () => {
  afterEach(() => {
    resetFeedLabBridgeConfigForTests();
    delete process.env.VITE_FEED_LAB_PROTOCOL_BRIDGE;
  });

  it('defaults protocol bridge to disabled', () => {
    expect(getFeedLabBridgeConfig().protocolBridge).toBe(false);
    expect(isFeedLabProtocolBridgeEnabled()).toBe(false);
  });

  it('enables protocol bridge when VITE_FEED_LAB_PROTOCOL_BRIDGE=true', () => {
    process.env.VITE_FEED_LAB_PROTOCOL_BRIDGE = 'true';
    resetFeedLabBridgeConfigForTests();
    expect(getFeedLabBridgeConfig().protocolBridge).toBe(true);
    expect(isFeedLabProtocolBridgeEnabled()).toBe(true);
  });
});
