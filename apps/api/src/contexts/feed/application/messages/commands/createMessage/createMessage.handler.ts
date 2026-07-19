import { randomUUID } from 'node:crypto';
import { parseKeyManifest } from '@/schemas/parseKeyManifest.js';
import { assertRecipientsRegistered } from '@/contexts/users/index.js';
import { messageRepository } from '@/contexts/feed/infrastructure/prismaMessageRepository.js';
import type { CreateMessageCommand } from './createMessage.command.js';

export async function handleCreateMessage(
  command: CreateMessageCommand,
): Promise<{ id: string }> {
  const keyManifest = parseKeyManifest(command.keyManifest);
  await assertRecipientsRegistered(Object.keys(keyManifest));

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
  );

  return { id: messageId };
}
