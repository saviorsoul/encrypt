import { randomUUID } from 'node:crypto';
import { parseKeyManifest } from '@/schemas/parseKeyManifest.js';
import { resolveDeliverableShareKeyManifest } from '@/contexts/feed/application/shares/resolveDeliverableShareKeyManifest.js';
import { badRequest } from '@/lib/httpError.js';
import { shareRepository } from '@/contexts/feed/infrastructure/prismaShareRepository.js';
import type { CreateShareCommand } from './createShare.command.js';
import type { CreateShareResponse } from '@encrypt/core/feed/shareAccess';

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
): Promise<CreateShareResponse> {
  const share = command.share as ManifestShareWire;
  const threadRootId = share.parentMessageId;

  if (!threadRootId) {
    throw badRequest('Share payload is missing parentMessageId.');
  }

  const keyManifest = await resolveDeliverableShareKeyManifest(
    parseKeyManifest(command.keyManifest),
    command.senderKeyId,
    threadRootId,
    command.parentMessage,
  );

  const shareCoreJson = JSON.stringify(command.share);
  const shareId = randomUUID();

  const result = await shareRepository.createShareWithAccess({
    shareId,
    threadRootId,
    shareCoreJson,
    keyManifest,
    parentMessage: command.parentMessage,
    messageId: command.messageId,
  });

  if (!result.created) {
    return { recipientsAlreadyHadAccess: true };
  }

  return { id: shareId };
}
