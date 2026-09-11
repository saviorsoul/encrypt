import {
  FRIENDSHIP_MUTE_SCOPE_MESSAGES,
  FRIENDSHIP_MUTE_SCOPE_SHARES,
  type FriendshipMuteScope,
} from '@/contexts/friendships/domain/constants.js';
import { resolveParentMessageAuthorKeyId } from '@/contexts/feed/application/shares/resolveParentMessageAuthorKeyId.js';

/**
 * Shares from someone else's message use sharesMuted. Sharing your own authored
 * message uses messagesMuted instead, so a recipient can block re-shares while
 * still accepting history sync of the author's own posts.
 */
export async function resolveShareDeliveryMuteScope(
  sharerKeyId: string,
  parentMessageId: string,
  parentMessage?: Record<string, unknown>,
): Promise<FriendshipMuteScope> {
  const parentSenderKeyId = await resolveParentMessageAuthorKeyId(
    parentMessageId,
    parentMessage,
  );

  if (parentSenderKeyId !== null && parentSenderKeyId === sharerKeyId) {
    return FRIENDSHIP_MUTE_SCOPE_MESSAGES;
  }

  return FRIENDSHIP_MUTE_SCOPE_SHARES;
}
