import type { FeedLabBridgeDeepLinkAction } from '@encrypt/core/feed/feedLabBridge';

export const PENDING_FEED_LAB_BRIDGE_ACTION_KEY =
  'encrypt-pending-feed-lab-bridge-action';

export type PendingFeedLabBridgeRequest = {
  action: FeedLabBridgeDeepLinkAction;
  browserPackage: string | null;
  confirmed: boolean;
};

export function readPendingFeedLabBridgeAction(): PendingFeedLabBridgeRequest | null {
  try {
    const raw = sessionStorage.getItem(PENDING_FEED_LAB_BRIDGE_ACTION_KEY);
    if (!raw) {
      return null;
    }
    return JSON.parse(raw) as PendingFeedLabBridgeRequest;
  } catch {
    return null;
  }
}

export function writePendingFeedLabBridgeAction(
  request: PendingFeedLabBridgeRequest | null,
): void {
  try {
    if (request) {
      sessionStorage.setItem(
        PENDING_FEED_LAB_BRIDGE_ACTION_KEY,
        JSON.stringify(request),
      );
    } else {
      sessionStorage.removeItem(PENDING_FEED_LAB_BRIDGE_ACTION_KEY);
    }
  } catch {
    /* ignore quota / privacy mode */
  }
}
