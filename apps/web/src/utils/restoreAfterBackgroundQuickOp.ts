/**
 * Show the Encrypt app when a feed bridge request needs user interaction
 * (login, key load, or confirmation).
 */
export async function ensureFeedBridgeVisibleForInteraction(): Promise<void> {
  await window.electron?.showMainWindow?.();
}

/**
 * Return the user to feed-lab after a background op-quick.
 * On desktop, only hides the window when it was not already visible.
 * On Android, moves the Encrypt task to the back after opening the callback URL.
 */
export async function restoreAfterBackgroundQuickOp(
  options: {
    wasMainWindowVisible?: boolean | null;
  } = {},
): Promise<void> {
  if (window.electron?.hideMainWindow) {
    const wasVisible =
      options.wasMainWindowVisible ??
      (await window.electron.isMainWindowVisible?.());
    if (wasVisible === false) {
      await window.electron.hideMainWindow();
    }
    return;
  }

  if (!import.meta.env.VITE_CAPACITOR) {
    return;
  }

  const { Capacitor } = await import('@capacitor/core');
  if (Capacitor.getPlatform() !== 'android') {
    return;
  }

  const { FeedLabExternalBrowser } =
    await import('@/capacitor/feedLabExternalBrowser.ts');
  await FeedLabExternalBrowser.returnToCaller();
}
