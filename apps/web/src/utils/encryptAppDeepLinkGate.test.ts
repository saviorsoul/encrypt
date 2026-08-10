import { describe, expect, it, beforeEach, vi } from 'vitest';
import {
  canOpenEncryptDeepLinkWithoutPrompt,
  clearEncryptDeepLinkSilentOpenAllowed,
  markEncryptDeepLinkBatchCancelled,
  markEncryptDeepLinkSilentOpenAllowed,
  openEncryptDeepLink,
  resetEncryptAppDeepLinkGateState,
  setEncryptAppDeepLinkOpenHandler,
  suppressEncryptDeepLinkAutoOpen,
} from '../../../feed-lab/src/lib/encryptAppDeepLinkGate.ts';

describe('encryptAppDeepLinkGate', () => {
  const originalUserAgent = navigator.userAgent;

  beforeEach(() => {
    sessionStorage.clear();
    resetEncryptAppDeepLinkGateState();
    setEncryptAppDeepLinkOpenHandler(null);
    vi.restoreAllMocks();
    Object.defineProperty(navigator, 'userActivation', {
      configurable: true,
      value: { isActive: false },
    });
    Object.defineProperty(navigator, 'userAgent', {
      configurable: true,
      value: originalUserAgent,
    });
  });

  it('opens without the consent handler when user activation is active', async () => {
    Object.defineProperty(navigator, 'userActivation', {
      configurable: true,
      value: { isActive: true },
    });
    const clickSpy = vi.spyOn(HTMLAnchorElement.prototype, 'click');

    setEncryptAppDeepLinkOpenHandler(() => {
      throw new Error('handler should not run');
    });

    await openEncryptDeepLink('encrypt://feed-op?session=1');

    expect(clickSpy).toHaveBeenCalled();
  });

  it('uses the consent handler when activation expired and silent open is unknown', async () => {
    const handler = vi.fn();
    setEncryptAppDeepLinkOpenHandler(handler);

    const promise = openEncryptDeepLink('encrypt://feed-op?session=1');

    expect(handler).toHaveBeenCalledTimes(1);
    handler.mock.calls[0]?.[0].resolve();
    await promise;
  });

  it('skips the consent handler after a successful silent bridge round-trip', async () => {
    markEncryptDeepLinkSilentOpenAllowed();
    const clickSpy = vi.spyOn(HTMLAnchorElement.prototype, 'click');

    setEncryptAppDeepLinkOpenHandler(() => {
      throw new Error('handler should not run');
    });

    await openEncryptDeepLink('encrypt://feed-op?session=1');

    expect(clickSpy).toHaveBeenCalled();
    expect(canOpenEncryptDeepLinkWithoutPrompt()).toBe(true);
  });

  it('blocks auto-open immediately after cancel', () => {
    markEncryptDeepLinkSilentOpenAllowed();
    markEncryptDeepLinkBatchCancelled();
    suppressEncryptDeepLinkAutoOpen();

    expect(canOpenEncryptDeepLinkWithoutPrompt()).toBe(false);
  });

  it('clears remembered silent-open capability', () => {
    markEncryptDeepLinkSilentOpenAllowed();
    clearEncryptDeepLinkSilentOpenAllowed();
    expect(canOpenEncryptDeepLinkWithoutPrompt()).toBe(false);
  });

  it('requires the consent handler on Android even after a successful silent round-trip', async () => {
    Object.defineProperty(navigator, 'userAgent', {
      configurable: true,
      value:
        'Mozilla/5.0 (Linux; Android 14) AppleWebKit/537.36 Chrome/120.0.0.0 Mobile Safari/537.36',
    });
    markEncryptDeepLinkSilentOpenAllowed();
    expect(canOpenEncryptDeepLinkWithoutPrompt()).toBe(false);

    const handler = vi.fn();
    setEncryptAppDeepLinkOpenHandler(handler);

    const promise = openEncryptDeepLink('encrypt://feed-op?session=1');

    expect(handler).toHaveBeenCalledTimes(1);
    handler.mock.calls[0]?.[0].resolve();
    await promise;
  });
});
