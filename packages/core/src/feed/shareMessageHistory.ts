import type { FeedApi } from '../api/feedApi.ts';
import type { InboxApiItem } from './types.ts';
import {
  inboxApiItemsToStoredDeliveries,
  type StoredFeedDelivery,
} from './types.ts';
import type { KeyManifestRecipientPayload } from '../types/manifest.ts';
import type { KeyManifestLookup } from './access.ts';
import type { ManifestRecipientKeys } from '../types/manifest.ts';

export type ShareMessageHistoryProgress = {
  done: number;
  total: number;
  currentMessageId: string | null;
};

export type ShareMessageHistoryRecipient = {
  keyId: string;
  publicKey: CryptoKey;
};

export type ShareMessageHistoryDeps = {
  api: Pick<
    FeedApi,
    'getAuthoredMessages' | 'getFriendships' | 'markMessageHistoryShared'
  >;
  shareMessagesBatch: (params: {
    messageIds: string[];
    recipients: ManifestRecipientKeys[];
    allDeliveries: StoredFeedDelivery[];
    manifestLookup: KeyManifestLookup;
    onProgress?: (done: number, total: number) => void;
  }) => Promise<void>;
  friendKeyId: string;
  friendPublicKey: CryptoKey;
  onProgress?: (progress: ShareMessageHistoryProgress) => void;
};

async function resolveFriendshipCreatedAt(
  api: ShareMessageHistoryDeps['api'],
  friendKeyId: string,
): Promise<string> {
  const friendships = await api.getFriendships();
  const friendship = friendships.find(
    (entry) => entry.friendKeyId === friendKeyId,
  );
  if (!friendship) {
    throw new Error('Friendship not found.');
  }
  return friendship.createdAt;
}

async function fetchAuthoredMessagesForShare(
  api: ShareMessageHistoryDeps['api'],
  before: string,
): Promise<{
  messageIds: string[];
  allDeliveries: StoredFeedDelivery[];
  manifestLookup: KeyManifestLookup;
}> {
  const manifestCache = new Map<
    string,
    Record<string, KeyManifestRecipientPayload>
  >();
  const rawItems: InboxApiItem[] = [];
  let cursor: string | null | undefined = undefined;

  do {
    const page = await api.getAuthoredMessages({
      cursor: cursor ?? undefined,
      limit: 100,
      order: 'desc',
      before,
    });
    for (const item of page.items) {
      rawItems.push(item);
      manifestCache.set(item.id, item.keyManifest);
    }
    cursor = page.nextCursor;
  } while (cursor);

  const manifestLookup: KeyManifestLookup = (messageId, recipientKeyId) =>
    manifestCache.get(messageId)?.[recipientKeyId] ?? null;

  return {
    messageIds: rawItems.map((item) => item.id),
    allDeliveries: inboxApiItemsToStoredDeliveries(rawItems),
    manifestLookup,
  };
}

export async function shareMessageHistoryWithFriend(
  deps: ShareMessageHistoryDeps,
): Promise<void> {
  const friendshipCreatedAt = await resolveFriendshipCreatedAt(
    deps.api,
    deps.friendKeyId,
  );
  const { messageIds, allDeliveries, manifestLookup } =
    await fetchAuthoredMessagesForShare(deps.api, friendshipCreatedAt);

  deps.onProgress?.({
    done: 0,
    total: messageIds.length,
    currentMessageId: null,
  });

  await deps.shareMessagesBatch({
    messageIds,
    recipients: [
      {
        keyId: deps.friendKeyId,
        publicKey: deps.friendPublicKey,
      },
    ],
    allDeliveries,
    manifestLookup,
    onProgress: (done, total) => {
      deps.onProgress?.({
        done,
        total,
        currentMessageId: null,
      });
    },
  });

  deps.onProgress?.({
    done: messageIds.length,
    total: messageIds.length,
    currentMessageId: null,
  });

  await deps.api.markMessageHistoryShared({
    friendKeyId: deps.friendKeyId,
  });
}
