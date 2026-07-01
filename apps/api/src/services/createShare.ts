import { randomUUID } from 'node:crypto';
import type { CreateShareRequest } from '../schemas/common.js';
import { parseKeyManifest } from '../schemas/parseKeyManifest.js';
import { prisma } from '../lib/prisma.js';
import {
  filterRecipientsWithoutMessageAccess,
  insertManifestShards,
} from '../db/manifestShards.js';
import { insertMessage } from '../db/messages.js';
import { insertShare } from '../db/shares.js';
import { assertRecipientsRegistered } from '../db/users.js';
import { badRequest, notFound } from '../lib/httpError.js';
import { verifyManifestSignature } from '../crypto/signatures.js';

type ManifestShareWire = {
  parentMessageId: string;
  sharerSignature: string;
  version: number;
  wrap: string;
  sharerPublicJwk: JsonWebKey;
  ephemeralPublicKey: JsonWebKey;
};

export async function createShare(
  body: CreateShareRequest,
): Promise<{ id: string }> {
  const share = body.share as ManifestShareWire;
  const threadRootId = share.parentMessageId;

  if (!threadRootId) {
    throw badRequest('Share payload is missing parentMessageId.');
  }

  const keyManifest = parseKeyManifest(body.keyManifest);
  await assertRecipientsRegistered(Object.keys(keyManifest));

  const shareCoreJson = JSON.stringify(body.share);

  const shareId = randomUUID();

  await prisma.$transaction(async (tx) => {
    if (!(await tx.message.findUnique({ where: { id: threadRootId } }))) {
      if (!body.parentMessage) {
        throw notFound(`Parent message not found: ${threadRootId}`);
      }

      await verifyManifestSignature(
        body.parentMessage as Parameters<typeof verifyManifestSignature>[0],
      );

      const parentId = body.messageId ?? threadRootId;
      if (parentId !== threadRootId) {
        throw badRequest(
          'messageId must match share.parentMessageId when providing parentMessage.',
        );
      }

      await insertMessage(tx, parentId, JSON.stringify(body.parentMessage));
    }

    const newRecipientKeyIds = await filterRecipientsWithoutMessageAccess(
      threadRootId,
      Object.keys(keyManifest),
      tx,
    );
    if (newRecipientKeyIds.length === 0) {
      throw badRequest(
        'All selected recipients already have access to this message.',
      );
    }

    const filteredKeyManifest = Object.fromEntries(
      newRecipientKeyIds.map((keyId) => [keyId, keyManifest[keyId]]),
    );

    await insertShare(tx, shareId, threadRootId, shareCoreJson);
    await insertManifestShards(tx, threadRootId, filteredKeyManifest, {
      shareId,
    });
  });

  return { id: shareId };
}
