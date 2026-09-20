export const ENCRYPT_APP_DEEP_LINK_CANCELLED_ERROR =
  'Opening the Encrypt app was cancelled.';

const SILENT_DEEP_LINK_STORAGE_KEY = 'encrypt:feed-lab-silent-deeplink';

type PendingDeepLinkOpen = {
  url: string;
  resolve: () => void;
  reject: (error: Error) => void;
};

type DeepLinkOpenHandler = (pending: PendingDeepLinkOpen) => void;

let openHandler: DeepLinkOpenHandler | null = null;
let suppressAutoOpenUntil = 0;
let deepLinkBatchCancelled = false;
let deepLinkBatchCancelResetTimer: ReturnType<typeof setTimeout> | null = null;

/** Test helper: reset transient gate state between unit tests. */
export function resetEncryptAppDeepLinkGateState(): void {
  suppressAutoOpenUntil = 0;
  deepLinkBatchCancelled = false;
  if (deepLinkBatchCancelResetTimer) {
    clearTimeout(deepLinkBatchCancelResetTimer);
    deepLinkBatchCancelResetTimer = null;
  }
}

export function setEncryptAppDeepLinkOpenHandler(
  handler: DeepLinkOpenHandler | null,
): void {
  openHandler = handler;
}

/** Block programmatic encrypt:// opens after the user cancels the consent dialog. */
export function suppressEncryptDeepLinkAutoOpen(durationMs = 1_000): void {
  suppressAutoOpenUntil = Date.now() + durationMs;
}

/** Reject new deep-link prompts until the next user action window opens. */
export function markEncryptDeepLinkBatchCancelled(durationMs = 1_000): void {
  deepLinkBatchCancelled = true;
  if (deepLinkBatchCancelResetTimer) {
    clearTimeout(deepLinkBatchCancelResetTimer);
  }
  deepLinkBatchCancelResetTimer = setTimeout(() => {
    deepLinkBatchCancelled = false;
    deepLinkBatchCancelResetTimer = null;
  }, durationMs);
}

export function hasTransientUserActivation(): boolean {
  if (typeof navigator === 'undefined' || !('userActivation' in navigator)) {
    return false;
  }
  const activation = (
    navigator as Navigator & { userActivation?: { isActive: boolean } }
  ).userActivation;
  return Boolean(activation?.isActive);
}

export function isAndroidMobileBrowser(): boolean {
  if (typeof navigator === 'undefined') {
    return false;
  }
  return /Android/i.test(navigator.userAgent);
}

function readSilentDeepLinkAllowed(): boolean {
  if (typeof sessionStorage === 'undefined') {
    return false;
  }
  return sessionStorage.getItem(SILENT_DEEP_LINK_STORAGE_KEY) === '1';
}

/** Remember that this browser tab can open encrypt:// without an extra tap. */
export function markEncryptDeepLinkSilentOpenAllowed(): void {
  if (typeof sessionStorage === 'undefined') {
    return;
  }
  sessionStorage.setItem(SILENT_DEEP_LINK_STORAGE_KEY, '1');
}

export function clearEncryptDeepLinkSilentOpenAllowed(): void {
  if (typeof sessionStorage === 'undefined') {
    return;
  }
  sessionStorage.removeItem(SILENT_DEEP_LINK_STORAGE_KEY);
}

/**
 * Whether encrypt:// can be opened without the in-page consent dialog.
 * True when the browser still has transient user activation from a recent
 * click, or when a prior bridge round-trip succeeded without needing a tap.
 */
export function canOpenEncryptDeepLinkWithoutPrompt(): boolean {
  if (deepLinkBatchCancelled) {
    return false;
  }
  if (Date.now() < suppressAutoOpenUntil) {
    return false;
  }
  if (hasTransientUserActivation()) {
    return true;
  }
  if (isAndroidMobileBrowser()) {
    return false;
  }
  return readSilentDeepLinkAllowed();
}

export function launchEncryptDeepLink(url: string): void {
  const anchor = document.createElement('a');
  anchor.href = url;
  anchor.rel = 'noopener noreferrer';
  anchor.style.display = 'none';
  document.body.appendChild(anchor);
  anchor.click();
  document.body.removeChild(anchor);
}

/**
 * Browsers block programmatic encrypt:// navigation once transient user
 * activation expires. Fall back to an in-page tap when needed.
 */
export async function openEncryptDeepLink(url: string): Promise<void> {
  if (deepLinkBatchCancelled) {
    return Promise.reject(new Error(ENCRYPT_APP_DEEP_LINK_CANCELLED_ERROR));
  }

  if (canOpenEncryptDeepLinkWithoutPrompt()) {
    launchEncryptDeepLink(url);
    return;
  }

  if (!openHandler) {
    launchEncryptDeepLink(url);
    return;
  }

  return new Promise<void>((resolve, reject) => {
    openHandler?.({
      url,
      resolve: () => {
        launchEncryptDeepLink(url);
        resolve();
      },
      reject,
    });
  });
}
