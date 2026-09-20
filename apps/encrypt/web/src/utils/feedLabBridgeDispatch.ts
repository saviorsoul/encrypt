import type { FeedLabBridgeDeepLinkAction } from '@encrypt/core/feed/feedLabBridge';

type FeedLabBridgeListener = (action: FeedLabBridgeDeepLinkAction) => void;

let feedLabBridgeListener: FeedLabBridgeListener | null = null;
const handledBridgeActionKeys = new Set<string>();

function bridgeActionDedupeKey(
  action: FeedLabBridgeDeepLinkAction,
): string | null {
  if (action.type === 'feed-op') {
    return `feed-op:${action.requestId}`;
  }
  if (action.type === 'feed-pair') {
    return `feed-pair:${action.session}`;
  }
  return null;
}

export function setFeedLabBridgeListener(
  listener: FeedLabBridgeListener | null,
): void {
  feedLabBridgeListener = listener;
}

export function dispatchFeedLabBridgeAction(
  action: FeedLabBridgeDeepLinkAction,
): void {
  const dedupeKey = bridgeActionDedupeKey(action);
  if (dedupeKey) {
    if (handledBridgeActionKeys.has(dedupeKey)) {
      return;
    }
    handledBridgeActionKeys.add(dedupeKey);
  }

  feedLabBridgeListener?.(action);
}

export function isFeedLabBridgeDeepLinkAction(action: {
  type: string;
}): action is FeedLabBridgeDeepLinkAction {
  return action.type === 'feed-pair' || action.type === 'feed-op';
}

export function resetFeedLabBridgeActionDedupeForTests(): void {
  handledBridgeActionKeys.clear();
}
