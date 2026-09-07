import type { CreateShareResponse } from '@encrypt/core/feed/shareAccess';
import { handleCreateShare } from '../createShare/createShare.handler.js';
import type { CreateShareCommand } from '../createShare/createShare.command.js';

export type CreateShareBatchCommand = {
  senderKeyId: string;
  shares: Array<Omit<CreateShareCommand, 'senderKeyId'>>;
};

export type CreateShareBatchItemResult = CreateShareResponse & {
  parentMessageId: string;
};

export type CreateShareBatchResponse = {
  results: CreateShareBatchItemResult[];
};

type ManifestShareWire = {
  parentMessageId: string;
};

export async function handleCreateShareBatch(
  command: CreateShareBatchCommand,
): Promise<CreateShareBatchResponse> {
  const results: CreateShareBatchItemResult[] = [];

  for (const shareCommand of command.shares) {
    const parentMessageId = (shareCommand.share as ManifestShareWire)
      .parentMessageId;
    const result = await handleCreateShare({
      ...shareCommand,
      senderKeyId: command.senderKeyId,
    });
    results.push({ parentMessageId, ...result });
  }

  return { results };
}
