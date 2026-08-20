import { type PrismaTx } from '@/lib/prisma.js';
import { deleteCommentsForMessages } from './prismaCommentRepository.js';
import {
  deleteManifestShardsForRecipientKeyId,
  listMessageIdsForRecipientManifestShards,
  listMessageIdsWithRemainingManifestShards,
} from './prismaManifestShardRepository.js';
import { deleteMessagesByIds } from './prismaMessageRepository.js';
import { deleteSharesForMessages } from './prismaShareRepository.js';

/**
 * Remove this recipient's manifest shards and ciphertext that nobody else
 * can still decrypt. Leaves messages that other recipients still hold.
 */
export async function eraseRecipientFeedData(
  recipientKeyId: string,
  tx?: PrismaTx,
): Promise<void> {
  const messageIds = await listMessageIdsForRecipientManifestShards(
    recipientKeyId,
    tx,
  );

  await deleteManifestShardsForRecipientKeyId(recipientKeyId, tx);

  if (messageIds.length === 0) {
    return;
  }

  const stillHeld = new Set(
    await listMessageIdsWithRemainingManifestShards(messageIds, tx),
  );
  const orphanedMessageIds = messageIds.filter((id) => !stillHeld.has(id));

  if (orphanedMessageIds.length === 0) {
    return;
  }

  await deleteCommentsForMessages(orphanedMessageIds, tx);
  await deleteSharesForMessages(orphanedMessageIds, tx);
  await deleteMessagesByIds(orphanedMessageIds, tx);
}
