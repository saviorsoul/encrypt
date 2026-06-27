import { verifyCommentSignature } from '@/crypto/commentCrypto.ts';
import { canCommentOnParentMessage } from '@/crypto/manifestShare.ts';
import type { ParsedCommentImportPayload } from '@/types/comment.ts';
import { getStoredMessageById } from '@/services/db/storedMessages.ts';
import {
  listCommentsForMessage,
  saveStoredComment,
  type StoredComment,
} from '@/services/db/storedComments.ts';

export async function importParsedComment(
  payload: ParsedCommentImportPayload,
  recipientKeyId: string,
): Promise<StoredComment> {
  await verifyCommentSignature(payload);

  const { messageId } = payload;
  const parentMessage = await getStoredMessageById(messageId);
  if (!parentMessage) {
    throw new Error('Parent message not found.');
  }

  if (!(await canCommentOnParentMessage(messageId, recipientKeyId))) {
    throw new Error(
      'You cannot import this comment - you are not the sender or a recipient of the parent message.',
    );
  }

  const commentPayloadJson = JSON.stringify(payload);
  const existingComments = await listCommentsForMessage(messageId);
  if (existingComments.some((row) => row.payload === commentPayloadJson)) {
    throw new Error('This comment is already stored for this message.');
  }

  return saveStoredComment(messageId, commentPayloadJson);
}
