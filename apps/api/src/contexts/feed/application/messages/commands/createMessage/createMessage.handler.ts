import { randomUUID } from 'node:crypto';
import { parseKeyManifest } from '@/schemas/parseKeyManifest.js';
import { friendshipRepository } from '@/contexts/friendships/infrastructure/prismaFriendshipRepository.js';
import { messageRepository } from '@/contexts/feed/infrastructure/prismaMessageRepository.js';
import { filterKeyManifestToFriends } from '@/contexts/feed/application/messages/filterKeyManifestToFriends.js';
import type { CreateMessageCommand } from './createMessage.command.js';

export async function handleCreateMessage(
  command: CreateMessageCommand,
): Promise<{ id: string }> {
  const friendKeyIds = await friendshipRepository.listFriendKeyIds(
    command.senderKeyId,
  );
  const keyManifest = filterKeyManifestToFriends(
    parseKeyManifest(command.keyManifest),
    command.senderKeyId,
    friendKeyIds,
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
  );

  return { id: messageId };
}
