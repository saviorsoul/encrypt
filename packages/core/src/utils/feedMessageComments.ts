import type { StoredMessage } from '../feed/types.ts';

export function messageHasComments(
  message: Pick<StoredMessage, 'lastCommentAt'>,
): boolean {
  return message.lastCommentAt != null;
}
