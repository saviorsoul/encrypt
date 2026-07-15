import { randomUUID } from 'node:crypto';
import '../src/loadEnv.js';
import { insertFriendshipPair } from '../src/db/friendships.js';
import { prisma } from '../src/lib/prisma.js';

export async function seedFriendship(
  keyIdA: string,
  keyIdB: string,
): Promise<void> {
  if (keyIdA === keyIdB) {
    throw new Error('Cannot seed a friendship between the same user.');
  }

  const users = await prisma.user.findMany({
    where: { keyId: { in: [keyIdA, keyIdB] } },
    select: { keyId: true },
  });
  if (users.length !== 2) {
    const found = new Set(users.map((user) => user.keyId));
    const missing = [keyIdA, keyIdB].filter((keyId) => !found.has(keyId));
    throw new Error(
      `Users not found for friendship seed: ${missing.join(', ')}`,
    );
  }

  const invitationToken = randomUUID();
  await prisma.$transaction((tx) =>
    insertFriendshipPair(tx, keyIdA, keyIdB, invitationToken),
  );
  console.log(`Friendship seeded between ${keyIdA} and ${keyIdB}`);
}

function readKeyIds(argv: string[]): [string, string] {
  const [keyIdA, keyIdB] = argv;
  if (!keyIdA || !keyIdB) {
    throw new Error('Usage: npm run db:seed:friendship -- <keyIdA> <keyIdB>');
  }
  return [keyIdA, keyIdB];
}

async function main(): Promise<void> {
  const [keyIdA, keyIdB] = readKeyIds(process.argv.slice(2));
  await seedFriendship(keyIdA, keyIdB);
}

main()
  .catch((error) => {
    console.error(error);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
