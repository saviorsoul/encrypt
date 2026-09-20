import {
  validateFeedLabBridgeCallbackPath,
  type FeedLabBridgeOpenExternalMode,
} from '@encrypt/core/feed/feedLabBridgeOpenExternal';

export type OpenExternalUrlOptions = {
  /** Android: open in the browser package that launched encrypt:// */
  browserPackage?: string | null;
  /**
   * Open the URL without stealing OS focus when supported.
   * Electron uses `shell.openExternal({ activate: false })` on macOS.
   */
  background?: boolean;
};

export async function openExternalUrl(
  url: string,
  mode: FeedLabBridgeOpenExternalMode = 'op',
  options?: OpenExternalUrlOptions,
): Promise<void> {
  const validationError = validateFeedLabBridgeCallbackPath(url, mode);
  if (validationError) {
    throw new Error(validationError);
  }

  if (window.electron?.openExternal) {
    await window.electron.openExternal(url, {
      background: options?.background === true,
    });
    return;
  }

  if (import.meta.env.VITE_CAPACITOR) {
    const { Capacitor } = await import('@capacitor/core');
    if (Capacitor.getPlatform() === 'android') {
      const { FeedLabExternalBrowser } =
        await import('@/capacitor/feedLabExternalBrowser.ts');
      await FeedLabExternalBrowser.openInBrowser({
        url,
        packageName: options?.browserPackage ?? null,
        background: options?.background === true,
      });
      return;
    }

    const { Browser } = await import('@capacitor/browser');
    await Browser.open({ url });
    return;
  }

  window.open(url, '_blank', 'noopener,noreferrer');
}
