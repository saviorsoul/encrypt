import { randomUUID } from 'node:crypto';
import type { CommentPayloadBody } from '../schemas/common.js';
import { getMessageById } from '../db/messages.js';
import { listCommentsForMessage, insertComment } from '../db/comments.js';
import { notFound } from '../lib/httpError.js';

type CommentPayload = CommentPayloadBody & {
  messageId: string;
};

export type CommentApiRow = {
  id: string;
  messageId: string;
  payload: string;
  createdAt: string;
};

export async function createComment(
  body: CommentPayload,
): Promise<{ id: string }> {
  const messageId = body.messageId;
  if (!(await getMessageById(messageId))) {
    throw notFound(`Parent message not found: ${messageId}`);
  }

  const commentId = randomUUID();
  const payload = JSON.stringify(body);

  await insertComment(commentId, messageId, payload);

  return { id: commentId };
}

export async function listComments(
  messageId: string,
): Promise<CommentApiRow[]> {
  const comments = await listCommentsForMessage(messageId);
  return comments.map((comment) => ({
    id: comment.id,
    messageId: comment.messageId,
    payload: comment.payload,
    createdAt: new Date(comment.createdAt).toISOString(),
  }));
}
