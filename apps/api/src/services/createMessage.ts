import { randomUUID } from 'node:crypto';
import type { CreateMessageRequest } from '../schemas/common.js';
import { parseKeyManifest } from '../schemas/parseKeyManifest.js';
import { prisma } from '../lib/prisma.js';
import { insertManifestShards } from '../db/manifestShards.js';
import { insertMessage } from '../db/messages.js';
import { assertRecipientsRegistered } from '../db/users.js';
import { conflict } from '../lib/httpError.js';

export async function createMessage(
  body: CreateMessageRequest,
): Promise<{ id: string }> {
  const keyManifest = parseKeyManifest(body.keyManifest);
  await assertRecipientsRegistered(Object.keys(keyManifest));

  const corePayloadJson = JSON.stringify({
    version: body.version,
    wrap: body.wrap,
    senderPublicJwk: body.senderPublicJwk,
    ephemeralPublicKey: body.ephemeralPublicKey,
    encryptedContent: body.encryptedContent,
    senderSignature: body.senderSignature,
  });
  const messageId = randomUUID();

  try {
    await prisma.$transaction(async (tx) => {
      await insertMessage(tx, messageId, corePayloadJson);
      await insertManifestShards(tx, messageId, keyManifest);
    });
  } catch (error) {
    if (
      error instanceof Error &&
      'code' in error &&
      (error as { code: string }).code === 'P2002'
    ) {
      throw conflict(`Message already exists: ${messageId}`);
    }
    throw error;
  }

  return { id: messageId };
}
