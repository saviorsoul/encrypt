import type { CommentPayloadBody } from '@/schemas/common.js';

export type CreateCommentCommand = CommentPayloadBody & {
  messageId: string;
};
