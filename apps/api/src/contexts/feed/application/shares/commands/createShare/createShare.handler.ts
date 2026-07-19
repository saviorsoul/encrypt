import { randomUUID } from 'node:crypto';
import { parseKeyManifest } from '@/schemas/parseKeyManifest.js';
import { assertRecipientsRegistered } from '@/contexts/users/index.js';
import { badRequest } from '@/lib/httpError.js';
import { shareRepository } from '@/contexts/feed/infrastructure/prismaShareRepository.js';
import type { CreateShareCommand } from './createShare.command.js';

type ManifestShareWire = {
  parentMessageId: string;
  sharerSignature: string;
  version: number;
  wrap: string;
  sharerPublicJwk: JsonWebKey;
  ephemeralPublicKey: JsonWebKey;
};

export async function handleCreateShare(
  command: CreateShareCommand,
): Promise<{ id: string }> {
  const share = command.share as ManifestShareWire;
  const threadRootId = share.parentMessageId;

  if (!threadRootId) {
    throw badRequest('Share payload is missing parentMessageId.');
  }

  const keyManifest = parseKeyManifest(command.keyManifest);
  await assertRecipientsRegistered(Object.keys(keyManifest));

  const shareCoreJson = JSON.stringify(command.share);
  const shareId = randomUUID();

  await shareRepository.createShareWithAccess({
    shareId,
    threadRootId,
    shareCoreJson,
    keyManifest,
    parentMessage: command.parentMessage,
    messageId: command.messageId,
  });

  return { id: shareId };
}
