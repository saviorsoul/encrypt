import { randomUUID } from 'node:crypto';
import { FRIENDSHIP_MUTE_SCOPE_MESSAGES } from '@/contexts/friendships/domain/constants.js';
import { parseKeyManifest } from '@/schemas/parseKeyManifest.js';
import { messageRepository } from '@/contexts/feed/infrastructure/prismaMessageRepository.js';
import { resolveDeliverableKeyManifest } from '@/contexts/feed/application/messages/resolveDeliverableKeyManifest.js';
import type { CreateMessageCommand } from './createMessage.command.js';

export async function handleCreateMessage(
  command: CreateMessageCommand,
): Promise<{ id: string }> {
  const keyManifest = await resolveDeliverableKeyManifest(
    parseKeyManifest(command.keyManifest),
    command.senderKeyId,
    FRIENDSHIP_MUTE_SCOPE_MESSAGES,
  );

  const corePayloadJson = JSON.stringify({
    version: command.version,
    wrap: command.wrap,
    senderPublicJwk: command.senderPublicJwk,
    ephemeralPublicKey: command.ephemeralPublicKey,
    encryptedContent: command.encryptedContent,
    senderSignature: command.senderSignature,
  });
  const messageId = randomUUID();

  await messageRepository.createWithManifestShards(
    messageId,
    corePayloadJson,
    keyManifest,
    command.senderKeyId,
  );

  return { id: messageId };
}
