import { commentRepository } from '@/contexts/feed/infrastructure/prismaCommentRepository.js';

export type ListCommentsQuery = {
  messageId: string;
};

export type CommentApiRow = {
  id: string;
  messageId: string;
  payload: string;
  createdAt: string;
};

export async function handleListComments(
  query: ListCommentsQuery,
): Promise<CommentApiRow[]> {
  const comments = await commentRepository.listForMessage(query.messageId);
  return comments.map((comment) => ({
    id: comment.id,
    messageId: comment.messageId,
    payload: comment.payload,
    createdAt: new Date(comment.createdAt).toISOString(),
  }));
}
