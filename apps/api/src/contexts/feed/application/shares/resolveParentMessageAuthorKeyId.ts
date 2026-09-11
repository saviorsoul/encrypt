import { getSenderKeyIdFromCorePayload } from '@encrypt/core/crypto/manifestDecrypt';
import { messageRepository } from '@/contexts/feed/infrastructure/prismaMessageRepository.js';

export async function resolveParentMessageAuthorKeyId(
  parentMessageId: string,
  parentMessage?: Record<string, unknown>,
): Promise<string | null> {
  if (parentMessage) {
    return getSenderKeyIdFromCorePayload(JSON.stringify(parentMessage));
  }

  const stored = await messageRepository.getById(parentMessageId);
  if (!stored) {
    return null;
  }

  return getSenderKeyIdFromCorePayload(stored.payload);
}
