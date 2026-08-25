import process from 'node:process';
import { afterEach, describe, expect, it } from 'vitest';
import {
  ENCRYPT_PROTOCOL_DEEP_LINKS_DISABLED_MESSAGE,
  getEncryptProtocolConfig,
  isEncryptProtocolDeepLinksEnabled,
  rejectDisabledEncryptProtocolDeepLinks,
  resetEncryptProtocolConfigForTests,
} from '../../../electron/encryptProtocolConfig.js';

describe('encryptProtocolConfig', () => {
  afterEach(() => {
    resetEncryptProtocolConfigForTests();
    delete process.env.VITE_ENCRYPT_PROTOCOL_DEEP_LINKS;
  });

  it('defaults deep links to enabled', () => {
    expect(getEncryptProtocolConfig()).toEqual({ deepLinksEnabled: true });
    expect(isEncryptProtocolDeepLinksEnabled()).toBe(true);
    expect(rejectDisabledEncryptProtocolDeepLinks()).toEqual({ ok: true });
  });

  it('disables all deep links when VITE_ENCRYPT_PROTOCOL_DEEP_LINKS=false', () => {
    process.env.VITE_ENCRYPT_PROTOCOL_DEEP_LINKS = 'false';
    resetEncryptProtocolConfigForTests();

    expect(isEncryptProtocolDeepLinksEnabled()).toBe(false);
    expect(rejectDisabledEncryptProtocolDeepLinks()).toEqual({
      ok: false,
      error: ENCRYPT_PROTOCOL_DEEP_LINKS_DISABLED_MESSAGE,
      silent: true,
    });
  });
});
