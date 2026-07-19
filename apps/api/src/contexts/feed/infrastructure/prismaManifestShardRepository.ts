import type { KeyManifestMap } from '@encrypt/core/types/manifest';
import { prisma, type PrismaTx } from '@/lib/prisma.js';
import type { ManifestShardRepository } from '@/contexts/feed/domain/ports/ManifestShardRepository.js';

export async function filterRecipientsWithoutMessageAccess(
  parentMessageId: string,
  recipientKeyIds: string[],
  tx?: PrismaTx,
): Promise<string[]> {
  if (recipientKeyIds.length === 0) {
    return [];
  }

  const client = tx ?? prisma;
  const rows = await client.messageKeyManifestShard.findMany({
    where: {
      messageId: parentMessageId,
      recipientKeyId: { in: recipientKeyIds },
    },
    select: { recipientKeyId: true },
  });
  const hasAccess = new Set(rows.map((row) => row.recipientKeyId));
  return recipientKeyIds.filter((keyId) => !hasAccess.has(keyId));
}

export async function insertManifestShards(
  tx: PrismaTx,
  parentMessageId: string,
  keyManifest: KeyManifestMap,
  options?: { shareId?: string },
): Promise<void> {
  const shareId = options?.shareId ?? null;
  for (const [recipientKeyId, entry] of Object.entries(keyManifest)) {
    await tx.messageKeyManifestShard.create({
      data: {
        messageId: parentMessageId,
        recipientKeyId,
        shareId,
        entryJson: JSON.stringify(entry),
      },
    });
  }
}

export const manifestShardRepository: ManifestShardRepository = {
  async listDeliveryIdsForRecipientKeyId(
    recipientKeyId: string,
  ): Promise<string[]> {
    const rows = await prisma.messageKeyManifestShard.findMany({
      where: { recipientKeyId },
      select: { messageId: true, shareId: true },
    });

    return [...new Set(rows.map((row) => row.shareId ?? row.messageId))];
  },

  async getManifestEntry(
    parentMessageId: string,
    recipientKeyId: string,
  ): Promise<KeyManifestMap[string] | null> {
    const row = await prisma.messageKeyManifestShard.findUnique({
      where: {
        messageId_recipientKeyId: {
          messageId: parentMessageId,
          recipientKeyId,
        },
      },
    });

    if (!row || row.shareId !== null) {
      return null;
    }

    return JSON.parse(row.entryJson) as KeyManifestMap[string];
  },

  async getManifestEntryForDelivery(
    deliveryId: string,
    recipientKeyId: string,
  ): Promise<KeyManifestMap[string] | null> {
    const direct = await manifestShardRepository.getManifestEntry(
      deliveryId,
      recipientKeyId,
    );
    if (direct) {
      return direct;
    }

    const shareRow = await prisma.messageKeyManifestShard.findFirst({
      where: { shareId: deliveryId, recipientKeyId },
    });
    if (!shareRow) {
      return null;
    }

    return JSON.parse(shareRow.entryJson) as KeyManifestMap[string];
  },
};
