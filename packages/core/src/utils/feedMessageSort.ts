import type { KeyManifestLookup } from '../feed/access.ts';
import {
  getCommentThreadMessageId,
  isShareDelivery,
  pickCanonicalFeedMessage,
} from '../crypto/manifestShare.ts';
import type {
  FeedMessageSortMode,
  StoredFeedDelivery,
  StoredMessage,
} from '../feed/types.ts';

export type SortFeedMessagesParams = {
  messages: StoredMessage[];
  allDeliveries: StoredFeedDelivery[];
  viewerKeyId: string | null;
  manifestLookup: KeyManifestLookup;
  mode: FeedMessageSortMode;
  lastCommentOverrides?: ReadonlyMap<string, number>;
};

export function groupDeliveriesByThread(
  deliveries: StoredFeedDelivery[],
): Map<string, StoredFeedDelivery[]> {
  const threads = new Map<string, StoredFeedDelivery[]>();

  for (const delivery of deliveries) {
    const threadId = getCommentThreadMessageId(delivery);
    const group = threads.get(threadId) ?? [];
    group.push(delivery);
    threads.set(threadId, group);
  }

  return threads;
}

function hasDirectManifestAccess(
  parentMessageId: string,
  viewerKeyId: string,
  manifestLookup: KeyManifestLookup,
): boolean {
  const entry = manifestLookup(parentMessageId, viewerKeyId);
  return entry != null;
}

export function getViewerReceivedAt(
  threadDeliveries: StoredFeedDelivery[],
  viewerKeyId: string | null,
  manifestLookup: KeyManifestLookup,
): number {
  const parent = pickCanonicalFeedMessage(threadDeliveries);
  if (!parent) {
    return 0;
  }

  if (
    viewerKeyId != null &&
    hasDirectManifestAccess(parent.id, viewerKeyId, manifestLookup)
  ) {
    return parent.createdAt;
  }

  const shareDeliveries = threadDeliveries.filter(isShareDelivery);
  if (shareDeliveries.length > 0) {
    return Math.max(...shareDeliveries.map((share) => share.createdAt));
  }

  return parent.createdAt;
}

function getLastCommentSortAt(
  message: StoredMessage,
  lastCommentOverrides?: ReadonlyMap<string, number>,
): number {
  const override = lastCommentOverrides?.get(message.id);
  if (override != null) {
    return override;
  }
  return message.lastCommentAt ?? 0;
}

function getSortTimestamp(
  message: StoredMessage,
  threadDeliveries: StoredFeedDelivery[] | undefined,
  params: SortFeedMessagesParams,
): number {
  switch (params.mode) {
    case 'originalDate':
      return message.createdAt;
    case 'lastComment':
      return getLastCommentSortAt(message, params.lastCommentOverrides);
    case 'shareTime':
    default:
      return getViewerReceivedAt(
        threadDeliveries ?? [message],
        params.viewerKeyId,
        params.manifestLookup,
      );
  }
}

export function sortFeedMessages(
  params: SortFeedMessagesParams,
): StoredMessage[] {
  const threads = groupDeliveriesByThread(params.allDeliveries);

  return [...params.messages].sort((left, right) => {
    const leftAt = getSortTimestamp(left, threads.get(left.id), params);
    const rightAt = getSortTimestamp(right, threads.get(right.id), params);
    return rightAt - leftAt;
  });
}

export const FEED_MESSAGE_SORT_MODE_LABELS: Record<
  FeedMessageSortMode,
  string
> = {
  shareTime: 'Share',
  originalDate: 'Message',
  lastComment: 'Comment',
};
