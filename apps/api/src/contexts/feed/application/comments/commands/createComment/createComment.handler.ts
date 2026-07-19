import { randomUUID } from 'node:crypto';
import { notFound } from '@/lib/httpError.js';
import { commentRepository } from '@/contexts/feed/infrastructure/prismaCommentRepository.js';
import { messageRepository } from '@/contexts/feed/infrastructure/prismaMessageRepository.js';
import type { CreateCommentCommand } from './createComment.command.js';

export async function handleCreateComment(
  command: CreateCommentCommand,
): Promise<{ id: string }> {
  const messageId = command.messageId;
  if (!(await messageRepository.getById(messageId))) {
    throw notFound(`Parent message not found: ${messageId}`);
  }

  const commentId = randomUUID();
  const payload = JSON.stringify(command);

  await commentRepository.insert(commentId, messageId, payload);

  return { id: commentId };
}
