import type { KeyManifestMap } from '@encrypt/core/types/manifest';
import { prisma } from '../lib/prisma.js';

export async function listMessageIdsForRecipientKeyId(
  recipientKeyId: string,
): Promise<string[]> {
  const rows = await prisma.messageKeyManifestShard.findMany({
    where: { recipientKeyId },
    select: { messageId: true },
  });

  return [...new Set(rows.map((row) => row.messageId))];
}

export async function getManifestEntry(
  messageId: string,
  recipientKeyId: string,
): Promise<KeyManifestMap[string] | null> {
  const row = await prisma.messageKeyManifestShard.findUnique({
    where: {
      messageId_recipientKeyId: { messageId, recipientKeyId },
    },
  });

  if (!row) {
    return null;
  }

  return JSON.parse(row.entryJson) as KeyManifestMap[string];
}

export async function insertManifestShards(
  tx: Parameters<Parameters<typeof prisma.$transaction>[0]>[0],
  messageId: string,
  keyManifest: KeyManifestMap,
): Promise<void> {
  for (const [recipientKeyId, entry] of Object.entries(keyManifest)) {
    await tx.messageKeyManifestShard.create({
      data: {
        messageId,
        recipientKeyId,
        entryJson: JSON.stringify(entry),
      },
    });
  }
}
