import type { KeyManifestMap } from '@encrypt/core/types/manifest';
import {
  FRIENDSHIP_MUTE_SCOPE_MESSAGES,
  FRIENDSHIP_MUTE_SCOPE_SHARES,
} from '@/contexts/friendships/domain/constants.js';
import { friendshipRepository } from '@/contexts/friendships/infrastructure/prismaFriendshipRepository.js';
import { filterKeyManifestToFriends } from '@/contexts/feed/application/messages/filterKeyManifestToFriends.js';
import { resolveParentMessageAuthorKeyId } from '@/contexts/feed/application/shares/resolveParentMessageAuthorKeyId.js';

/**
 * Share delivery must respect both the sharer's mute scope and whether each
 * recipient muted the parent message's original author.
 */
export async function resolveDeliverableShareKeyManifest(
  keyManifest: KeyManifestMap,
  sharerKeyId: string,
  parentMessageId: string,
  parentMessage?: Record<string, unknown>,
): Promise<KeyManifestMap> {
  const authorKeyId = await resolveParentMessageAuthorKeyId(
    parentMessageId,
    parentMessage,
  );
  const sharerMuteScope =
    authorKeyId !== null && authorKeyId === sharerKeyId
      ? FRIENDSHIP_MUTE_SCOPE_MESSAGES
      : FRIENDSHIP_MUTE_SCOPE_SHARES;

  const recipientKeyIds = Object.keys(keyManifest).filter(
    (keyId) => keyId !== sharerKeyId,
  );

  const [sharerConstraints, recipientKeyIdsWhoMutedAuthorMessages] =
    await Promise.all([
      friendshipRepository.listDeliveryFriendshipConstraints(
        sharerKeyId,
        recipientKeyIds,
      ),
      authorKeyId !== null && authorKeyId !== sharerKeyId
        ? friendshipRepository.listRecipientsWhoMutedAuthorMessages(
            authorKeyId,
            recipientKeyIds,
          )
        : Promise.resolve(new Set<string>()),
    ]);

  const recipientKeyIdsWhoMutedSharer =
    sharerMuteScope === FRIENDSHIP_MUTE_SCOPE_MESSAGES
      ? sharerConstraints.recipientKeyIdsWhoMutedMessages
      : sharerConstraints.recipientKeyIdsWhoMutedShares;

  const recipientKeyIdsToExclude = new Set([
    ...recipientKeyIdsWhoMutedSharer,
    ...recipientKeyIdsWhoMutedAuthorMessages,
  ]);

  return filterKeyManifestToFriends(
    keyManifest,
    sharerKeyId,
    sharerConstraints.friendKeyIds,
    recipientKeyIdsToExclude,
  );
}
