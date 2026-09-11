import type { KeyManifestMap } from '@encrypt/core/types/manifest';
import {
  FRIENDSHIP_MUTE_SCOPE_MESSAGES,
  type FriendshipMuteScope,
} from '@/contexts/friendships/domain/constants.js';
import { friendshipRepository } from '@/contexts/friendships/infrastructure/prismaFriendshipRepository.js';
import { filterKeyManifestToFriends } from '@/contexts/feed/application/messages/filterKeyManifestToFriends.js';

export async function resolveDeliverableKeyManifest(
  keyManifest: KeyManifestMap,
  senderKeyId: string,
  scope: FriendshipMuteScope,
): Promise<KeyManifestMap> {
  const recipientKeyIds = Object.keys(keyManifest).filter(
    (keyId) => keyId !== senderKeyId,
  );
  const {
    friendKeyIds,
    recipientKeyIdsWhoMutedMessages,
    recipientKeyIdsWhoMutedShares,
  } = await friendshipRepository.listDeliveryFriendshipConstraints(
    senderKeyId,
    recipientKeyIds,
  );

  const recipientKeyIdsWhoMutedSender =
    scope === FRIENDSHIP_MUTE_SCOPE_MESSAGES
      ? recipientKeyIdsWhoMutedMessages
      : recipientKeyIdsWhoMutedShares;

  return filterKeyManifestToFriends(
    keyManifest,
    senderKeyId,
    friendKeyIds,
    recipientKeyIdsWhoMutedSender,
  );
}
