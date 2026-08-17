import '@api/loadEnv.js';
import { prisma } from '@api/lib/prisma.ts';
import { seedFriendship } from '../../../api/scripts/seed-friendship.ts';
import { E2E_INVITER_PRIVATE_KEY_PATH } from '@api/e2e/apiKeysPath.ts';
import { loadTestKeyMaterialFromFile } from './testKeys.ts';

export { E2E_INVITER_PRIVATE_KEY_PATH };

export async function isUserRegistered(keyId: string): Promise<boolean> {
  const user = await prisma.user.findUnique({
    where: { keyId },
    select: { keyId: true },
  });
  return user != null;
}

export async function listFriendKeyIds(ownerKeyId: string): Promise<string[]> {
  const friendships = await prisma.userFriendship.findMany({
    where: { ownerKeyId },
    select: { friendKeyId: true },
  });
  return friendships.map((friendship) => friendship.friendKeyId);
}

export async function isE2eInviterSeeded(): Promise<boolean> {
  try {
    const material = await loadTestKeyMaterialFromFile(
      E2E_INVITER_PRIVATE_KEY_PATH,
    );
    const user = await prisma.user.findUnique({
      where: { keyId: material.keyId },
      select: { keyId: true },
    });
    return user != null;
  } catch {
    return false;
  }
}

/** Inviter's seeded orphan friend (friend without a private key in e2e). */
export async function getE2eOrphanFriendKeyId(
  excludeKeyIds: string[] = [],
): Promise<string> {
  const inviterMaterial = await loadTestKeyMaterialFromFile(
    E2E_INVITER_PRIVATE_KEY_PATH,
  );
  const friendships = await prisma.userFriendship.findMany({
    where: { ownerKeyId: inviterMaterial.keyId },
    select: { friendKeyId: true },
  });
  const excluded = new Set(excludeKeyIds);
  const orphanFriend = friendships.find(
    (friendship) => !excluded.has(friendship.friendKeyId),
  );
  if (!orphanFriend) {
    throw new Error(
      'E2e orphan friend not seeded — run npm run db:seed:e2e in apps/api',
    );
  }
  return orphanFriend.friendKeyId;
}

export async function ensureFriendship(
  keyIdA: string,
  keyIdB: string,
): Promise<void> {
  const existing = await prisma.userFriendship.findFirst({
    where: {
      OR: [
        { ownerKeyId: keyIdA, friendKeyId: keyIdB },
        { ownerKeyId: keyIdB, friendKeyId: keyIdA },
      ],
    },
    select: { ownerKeyId: true },
  });
  if (existing) {
    return;
  }
  await seedFriendship(keyIdA, keyIdB);
}

export async function deleteUsers(keyIds: string[]): Promise<void> {
  const unique = [...new Set(keyIds)];
  if (unique.length === 0) {
    return;
  }

  await prisma.friendInvitation.deleteMany({
    where: {
      OR: [{ inviterKeyId: { in: unique } }, { inviteeKeyId: { in: unique } }],
    },
  });

  await prisma.friendshipRequest.deleteMany({
    where: {
      OR: [{ requesterKeyId: { in: unique } }, { targetKeyId: { in: unique } }],
    },
  });

  await prisma.userFriendship.deleteMany({
    where: {
      OR: [{ ownerKeyId: { in: unique } }, { friendKeyId: { in: unique } }],
    },
  });

  const manifestShards = await prisma.messageKeyManifestShard.findMany({
    where: { recipientKeyId: { in: unique } },
    select: { messageId: true },
  });
  const messageIds = [
    ...new Set(manifestShards.map((shard) => shard.messageId)),
  ];

  if (messageIds.length > 0) {
    await prisma.messageKeyManifestShard.deleteMany({
      where: { messageId: { in: messageIds } },
    });
    await prisma.comment.deleteMany({
      where: { messageId: { in: messageIds } },
    });
    await prisma.share.deleteMany({
      where: { messageId: { in: messageIds } },
    });
    await prisma.message.deleteMany({
      where: { id: { in: messageIds } },
    });
  }

  await prisma.user.deleteMany({
    where: { keyId: { in: unique } },
  });
}
