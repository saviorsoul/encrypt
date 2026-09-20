import { parseBaseJsonObjectOrThrow } from '@/utils/validateBaseJsonText.ts';
import type { CommentPayload } from '@/types/comment.ts';
import { getStoredMessageById } from '@/services/db/storedMessages.ts';
import type { StoredComment } from '@/services/db/storedComments.ts';

export function assembleCommentExportPayloadJson(
  commentPayloadJson: string,
): string {
  parseBaseJsonObjectOrThrow(commentPayloadJson) as unknown as CommentPayload;
  return commentPayloadJson;
}

export function commentExportFilename(): string {
  return `comment-${crypto.randomUUID().slice(0, 8)}.json`;
}

export async function assembleStoredCommentCopyPayload(
  comment: StoredComment,
): Promise<string> {
  const parentMessage = await getStoredMessageById(comment.messageId);
  if (!parentMessage) {
    throw new Error('Parent message not found.');
  }

  return assembleCommentExportPayloadJson(comment.payload);
}
