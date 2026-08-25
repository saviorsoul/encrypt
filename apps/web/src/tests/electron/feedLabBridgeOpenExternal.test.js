import process from 'node:process';
import { beforeEach, describe, expect, it } from 'vitest';
import {
  feedLabBridgeCallbackRoutePath,
  getFeedLabBridgeConfig,
  resetFeedLabBridgeConfigForTests,
  validateFeedLabBridgeCallbackPath,
  validateFeedLabOpenExternalUrl,
  validateFeedLabPairCallback,
  validateHttpExternalUrl,
} from '../../../electron/feedLabBridgeOpenExternal.js';

function useDefaultBridgeEnv() {
  process.env.VITE_FEED_LAB_HOSTNAME = 'feednt.com';
  process.env.VITE_FEED_LAB_DEV_HOSTNAME = 'localhost';
  process.env.VITE_FEED_LAB_PROTOCOL_BRIDGE = 'true';
  resetFeedLabBridgeConfigForTests();
}

beforeEach(() => {
  useDefaultBridgeEnv();
});

const PROD_ORIGIN = `https://${getFeedLabBridgeConfig().hostname}`;
const PROD_PAIR_CALLBACK = `${PROD_ORIGIN}/#/bridge-callback/pair`;
const PROD_OP_CALLBACK = `${PROD_ORIGIN}/#/bridge-callback`;
const LOCAL_PAIR_CALLBACK = 'http://localhost:5174/bridge-callback/pair';
const LOCAL_OP_CALLBACK = 'http://localhost:5174/bridge-callback';

describe('getFeedLabBridgeConfig', () => {
  it('reads hostname from env', () => {
    process.env.VITE_FEED_LAB_HOSTNAME = 'custom.example';
    resetFeedLabBridgeConfigForTests();

    const config = getFeedLabBridgeConfig();
    expect(config.hostname).toBe('custom.example');
  });
});

describe('validateHttpExternalUrl', () => {
  it('accepts https URLs', () => {
    expect(validateHttpExternalUrl(`${PROD_ORIGIN}/path`)).toBeNull();
  });

  it('rejects file URLs', () => {
    expect(validateHttpExternalUrl('file:///etc/passwd')).toMatch(/http/);
  });

  it('rejects URLs with credentials', () => {
    expect(
      validateHttpExternalUrl(
        `https://user:pass@${getFeedLabBridgeConfig().hostname}/callback`,
      ),
    ).toMatch(/credentials/);
  });
});

describe('validateFeedLabPairCallback', () => {
  it('accepts feednt.com hash-router pair callbacks', () => {
    expect(
      validateFeedLabPairCallback(PROD_PAIR_CALLBACK, PROD_ORIGIN),
    ).toBeNull();
  });

  it('accepts localhost dev pair callbacks', () => {
    expect(
      validateFeedLabPairCallback(LOCAL_PAIR_CALLBACK, 'http://localhost:5174'),
    ).toBeNull();
  });

  it('accepts private LAN IP pair callbacks over https without env listing', () => {
    expect(
      validateFeedLabPairCallback(
        'https://192.168.0.235:5174/bridge-callback/pair',
        'https://192.168.0.235:5174',
      ),
    ).toBeNull();
  });

  it('accepts private LAN IP op callbacks over http', () => {
    expect(
      validateFeedLabBridgeCallbackPath(
        'http://10.0.0.42:5174/bridge-callback',
        'op',
      ),
    ).toBeNull();
  });

  it('rejects callback origin mismatch', () => {
    expect(
      validateFeedLabPairCallback(
        'https://evil.example.com/#/bridge-callback/pair',
        PROD_ORIGIN,
      ),
    ).toMatch(/hostname must be/);
  });

  it('rejects non-configured production hostnames', () => {
    expect(
      validateFeedLabPairCallback(
        'https://feed.example.com/#/bridge-callback/pair',
        'https://feed.example.com',
      ),
    ).toMatch(/hostname must be/);
  });

  it('rejects non-pair callback paths', () => {
    expect(validateFeedLabPairCallback(PROD_OP_CALLBACK, PROD_ORIGIN)).toMatch(
      /pair route/,
    );
  });

  it('rejects http on production hostname', () => {
    const hostname = getFeedLabBridgeConfig().hostname;
    expect(
      validateFeedLabPairCallback(
        `http://${hostname}/#/bridge-callback/pair`,
        `http://${hostname}`,
      ),
    ).toMatch(/https/);
  });
});

describe('validateFeedLabBridgeCallbackPath', () => {
  it('accepts production op callback bases', () => {
    expect(
      validateFeedLabBridgeCallbackPath(PROD_OP_CALLBACK, 'op'),
    ).toBeNull();
  });

  it('accepts localhost dev op callback bases', () => {
    expect(
      validateFeedLabBridgeCallbackPath(LOCAL_OP_CALLBACK, 'op'),
    ).toBeNull();
  });

  it('parses hash routes without query params', () => {
    const path = feedLabBridgeCallbackRoutePath(
      new URL(`${PROD_PAIR_CALLBACK}?session=1`),
    );
    expect(path).toBe('/bridge-callback/pair');
  });

  it('rejects production pathname routes when protocol bridge is enabled', () => {
    expect(
      validateFeedLabBridgeCallbackPath(
        `${PROD_ORIGIN}/bridge-callback/pair`,
        'pair',
      ),
    ).toMatch(/hash routes/);
  });

  it('allows production pathname routes when protocol bridge is disabled', () => {
    delete process.env.VITE_FEED_LAB_PROTOCOL_BRIDGE;
    resetFeedLabBridgeConfigForTests();

    expect(
      validateFeedLabBridgeCallbackPath(
        `${PROD_ORIGIN}/bridge-callback/pair`,
        'pair',
      ),
    ).toBeNull();
  });
});

describe('validateFeedLabOpenExternalUrl', () => {
  it('accepts production pair and op callback URLs with query params', () => {
    expect(
      validateFeedLabOpenExternalUrl(`${PROD_PAIR_CALLBACK}?session=1`),
    ).toBeNull();
    expect(
      validateFeedLabOpenExternalUrl(`${PROD_OP_CALLBACK}?requestId=1`),
    ).toBeNull();
  });

  it('accepts localhost dev callback URLs', () => {
    expect(
      validateFeedLabOpenExternalUrl(`${LOCAL_OP_CALLBACK}?requestId=1`),
    ).toBeNull();
  });

  it('rejects unrelated https URLs', () => {
    expect(
      validateFeedLabOpenExternalUrl('https://evil.example.com/phish'),
    ).toMatch(/hostname must be/);
  });

  it('rejects lookalike paths on production host', () => {
    expect(
      validateFeedLabOpenExternalUrl(
        `${PROD_ORIGIN}/#/bridge-callback-evil?x=1`,
      ),
    ).toMatch(/callback route/);
  });
});
