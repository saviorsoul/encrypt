/** Build the feed-lab bridge callback URL for the current deployment. */
export function buildFeedLabBridgeCallbackBaseUrl(): string {
  if (import.meta.env.PROD) {
    const pathname = window.location.pathname.replace(/\/$/, '') || '';
    return `${window.location.origin}${pathname}#/bridge-callback`;
  }
  return `${window.location.origin}/bridge-callback`;
}

/** Build the feed-pair callback URL (pairing completion). */
export function buildFeedLabPairCallbackBaseUrl(): string {
  if (import.meta.env.PROD) {
    const pathname = window.location.pathname.replace(/\/$/, '') || '';
    return `${window.location.origin}${pathname}#/bridge-callback/pair`;
  }
  return `${window.location.origin}/bridge-callback/pair`;
}
