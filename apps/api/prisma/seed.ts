import type { Prisma } from '@prisma/client';
import '../src/loadEnv.js';
import {
  ecPublicJwkThumbprintSha256,
  slimEcPublicJwk,
} from '@encrypt/core/crypto/jwkThumbprint';
import { parsePublicKey } from '../src/schemas/parsePublicKey.js';
import { prisma } from '../src/lib/prisma.js';

const DEFAULT_SEED_COUNT = 2000;
const GENERATE_BATCH_SIZE = 50;
const INSERT_BATCH_SIZE = 500;

function seedCount(): number {
  const raw = process.env.SEED_USER_COUNT;
  if (!raw) {
    return DEFAULT_SEED_COUNT;
  }
  const parsed = Number.parseInt(raw, 10);
  if (!Number.isInteger(parsed) || parsed < 1) {
    throw new Error(`Invalid SEED_USER_COUNT: ${raw}`);
  }
  return parsed;
}

async function generateMockUser(): Promise<{
  keyId: string;
  publicKey: Prisma.InputJsonValue;
}> {
  const keyPair = await crypto.subtle.generateKey(
    { name: 'ECDSA', namedCurve: 'P-256' },
    true,
    ['sign', 'verify'],
  );
  const publicJwk = slimEcPublicJwk(
    await crypto.subtle.exportKey('jwk', keyPair.publicKey),
  );
  const keyId = await ecPublicJwkThumbprintSha256(publicJwk);
  return { keyId, publicKey: parsePublicKey(publicJwk) };
}

async function generateMockUsers(count: number) {
  const users: Array<{ keyId: string; publicKey: Prisma.InputJsonValue }> = [];
  for (let offset = 0; offset < count; offset += GENERATE_BATCH_SIZE) {
    const batchSize = Math.min(GENERATE_BATCH_SIZE, count - offset);
    const batch = await Promise.all(
      Array.from({ length: batchSize }, () => generateMockUser()),
    );
    users.push(...batch);
  }
  return users;
}

async function main(): Promise<void> {
  const total = seedCount();
  console.log(`Seeding ${total} mock users with random EC P-256 keys...`);

  const users = await generateMockUsers(total);
  let inserted = 0;

  for (let offset = 0; offset < users.length; offset += INSERT_BATCH_SIZE) {
    const batch = users.slice(offset, offset + INSERT_BATCH_SIZE);
    const result = await prisma.user.createMany({
      data: batch.map((user) => ({
        keyId: user.keyId,
        publicKey: user.publicKey,
      })),
      skipDuplicates: true,
    });
    inserted += result.count;
    console.log(
      `Inserted ${result.count} users (${Math.min(offset + batch.length, total)}/${total})`,
    );
  }

  console.log(
    `Done. ${inserted} new users inserted (${total - inserted} skipped as duplicates).`,
  );
}

main()
  .catch((error) => {
    console.error(error);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
