import process from 'node:process';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import {
  FEED_LAB_PROTOCOL_BRIDGE_DISABLED_MESSAGE,
  resetFeedLabBridgeConfigForTests,
} from '../../../electron/feedLabBridgeConfig.js';
import {
  buildDeepLink,
  findDeepLinkInArgv,
  isBackgroundFeedBridgeDeepLinkAction,
  parseDeepLink,
} from '../../../electron/deepLinks.js';

const FEED_PAIR_URL =
  'encrypt://feed-pair?origin=https%3A%2F%2Ffeednt.com&session=abc&callback=https%3A%2F%2Ffeednt.com%2F%23%2Fbridge-callback%2Fpair&bridgeSessionKeyId=b1&bridgeSessionPublicJwk=eyJrMSI6InYifQ';

const FEED_OP_URL =
  'encrypt://feed-op?session=s1&requestId=r1&op=ecdsa-sign&payload=eyJ0ZXN0IjoxfQ&bridgeSessionKeyId=b1&bridgeSessionPublicJwk=eyJrMSI6InYifQ';

describe('parseDeepLink', () => {
  it('parses copy-public-key', () => {
    expect(parseDeepLink('encrypt://copy-public-key')).toEqual({
      ok: true,
      action: { type: 'copy-public-key' },
    });
  });

  it('rejects removed encrypt://show', () => {
    expect(parseDeepLink('encrypt://show').ok).toBe(false);
  });

  it('parses encrypt with text', () => {
    expect(parseDeepLink('encrypt://encrypt?text=hello')).toEqual({
      ok: true,
      action: { type: 'encrypt', text: 'hello' },
    });
  });

  it('rejects encrypt to= param', () => {
    expect(parseDeepLink('encrypt://encrypt?text=hello&to=alice').ok).toBe(
      false,
    );
  });

  it('parses decrypt text', () => {
    expect(parseDeepLink('encrypt://decrypt?text=%7B%22a%22%3A1%7D')).toEqual({
      ok: true,
      action: { type: 'decrypt', text: '{"a":1}' },
    });
  });

  it('rejects removed encrypt://import', () => {
    expect(parseDeepLink('encrypt://import?text=%7B%22a%22%3A1%7D').ok).toBe(
      false,
    );
  });

  it('rejects empty encrypt text', () => {
    expect(parseDeepLink('encrypt://encrypt?text=').ok).toBe(false);
  });

  it('accepts long encrypt text', () => {
    const longText = 'x'.repeat(10_000);
    expect(parseDeepLink(buildDeepLink('encrypt', { text: longText }))).toEqual(
      {
        ok: true,
        action: { type: 'encrypt', text: longText },
      },
    );
  });

  it('rejects unknown actions and params', () => {
    expect(parseDeepLink('encrypt://nope').ok).toBe(false);
    expect(parseDeepLink('encrypt://encrypt?text=hi&extra=1').ok).toBe(false);
  });

  it('rejects feed-pair when protocol bridge is disabled', () => {
    expect(parseDeepLink(FEED_PAIR_URL)).toEqual({
      ok: false,
      error: FEED_LAB_PROTOCOL_BRIDGE_DISABLED_MESSAGE,
    });
  });

  it('rejects feed-op when protocol bridge is disabled', () => {
    expect(parseDeepLink(FEED_OP_URL)).toEqual({
      ok: false,
      error: FEED_LAB_PROTOCOL_BRIDGE_DISABLED_MESSAGE,
    });
  });

  it('detects background op-quick feed-op actions', () => {
    expect(
      isBackgroundFeedBridgeDeepLinkAction({
        type: 'feed-op',
        op: 'op-quick',
      }),
    ).toBe(true);
    expect(
      isBackgroundFeedBridgeDeepLinkAction({
        type: 'feed-op',
        op: 'ecdsa-sign',
      }),
    ).toBe(false);
  });
});

describe('parseDeepLink feed bridge (protocol bridge enabled)', () => {
  beforeEach(() => {
    process.env.VITE_FEED_LAB_PROTOCOL_BRIDGE = 'true';
    resetFeedLabBridgeConfigForTests();
  });

  afterEach(() => {
    delete process.env.VITE_FEED_LAB_PROTOCOL_BRIDGE;
    resetFeedLabBridgeConfigForTests();
  });

  it('parses feed-pair', () => {
    expect(parseDeepLink(FEED_PAIR_URL)).toEqual({
      ok: true,
      action: {
        type: 'feed-pair',
        origin: 'https://feednt.com',
        session: 'abc',
        callback: 'https://feednt.com/#/bridge-callback/pair',
        bridgeSessionKeyId: 'b1',
        bridgeSessionPublicJwk: 'eyJrMSI6InYifQ',
      },
    });
  });

  it('rejects feed-pair when callback origin mismatches origin param', () => {
    expect(
      parseDeepLink(
        'encrypt://feed-pair?origin=https%3A%2F%2Ffeednt.com&session=abc&callback=https%3A%2F%2Fevil.example.com%2F%23%2Fbridge-callback%2Fpair',
      ).ok,
    ).toBe(false);
  });

  it('rejects feed-pair when origin is not feednt.com', () => {
    expect(
      parseDeepLink(
        'encrypt://feed-pair?origin=https%3A%2F%2Ffeed.example.com&session=abc&callback=https%3A%2F%2Ffeed.example.com%2F%23%2Fbridge-callback%2Fpair',
      ).ok,
    ).toBe(false);
  });

  it('parses feed-op', () => {
    expect(parseDeepLink(FEED_OP_URL)).toEqual({
      ok: true,
      action: {
        type: 'feed-op',
        session: 's1',
        requestId: 'r1',
        op: 'ecdsa-sign',
        payload: 'eyJ0ZXN0IjoxfQ',
        origin: '',
        callback: '',
        bridgeSessionKeyId: 'b1',
        bridgeSessionPublicJwk: 'eyJrMSI6InYifQ',
      },
    });
  });
});

describe('findDeepLinkInArgv', () => {
  it('finds the protocol URL among argv', () => {
    expect(
      findDeepLinkInArgv([
        'electron',
        'encrypt://encrypt?text=hi',
        '/some/file.json',
      ]),
    ).toBe('encrypt://encrypt?text=hi');
  });

  it('finds quoted or embedded protocol URLs', () => {
    expect(
      findDeepLinkInArgv([
        '/opt/Encrypt/encrypt',
        "'encrypt://copy-public-key'",
      ]),
    ).toBe('encrypt://copy-public-key');
    expect(findDeepLinkInArgv(['something=encrypt://copy-public-key'])).toBe(
      'encrypt://copy-public-key',
    );
  });
});
