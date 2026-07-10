import { mkdir, readFile, writeFile } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import type { Prisma } from '@prisma/client';
import '../src/loadEnv.js';
import { jwkWithoutKeyOps } from '@encrypt/core/crypto/ecdhKeys';
import { importUploadedPrivateKeyMaterial } from '@encrypt/core/crypto/privateKeyMaterial';
import {
  ecPublicJwkThumbprintSha256,
  slimEcPrivateJwk,
  slimEcPublicJwk,
} from '@encrypt/core/crypto/jwkThumbprint';
import { parsePublicKey } from '../src/schemas/parsePublicKey.js';
import { prisma } from '../src/lib/prisma.js';

const DEFAULT_SEED_COUNT = 2000;
const SEED_DEV_KEY_FILENAME = 'seed-user-private-key.json';
const KEYS_DIR = path.resolve(
  path.dirname(fileURLToPath(import.meta.url)),
  '../keys',
);
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

async function readDevPrivateJwk(): Promise<JsonWebKey | null> {
  const keyPath = path.join(KEYS_DIR, SEED_DEV_KEY_FILENAME);
  try {
    const raw = await readFile(keyPath, 'utf8');
    return slimEcPrivateJwk(JSON.parse(raw) as JsonWebKey);
  } catch (error) {
    if ((error as NodeJS.ErrnoException).code === 'ENOENT') {
      return null;
    }
    throw error;
  }
}

async function seedDevUser(): Promise<void> {
  await mkdir(KEYS_DIR, { recursive: true });
  const keyPath = path.join(KEYS_DIR, SEED_DEV_KEY_FILENAME);

  let privateJwk = await readDevPrivateJwk();
  if (privateJwk) {
    console.log(`Reusing dev user private key at ${keyPath}`);
  } else {
    const keyPair = await crypto.subtle.generateKey(
      { name: 'ECDSA', namedCurve: 'P-256' },
      true,
      ['sign', 'verify'],
    );
    privateJwk = slimEcPrivateJwk(
      (await crypto.subtle.exportKey('jwk', keyPair.privateKey)) as JsonWebKey,
    );
    await writeFile(
      keyPath,
      `${JSON.stringify(jwkWithoutKeyOps(privateJwk), null, 2)}\n`,
      'utf8',
    );
    console.log(`Wrote dev user private key to ${keyPath}`);
  }

  const material = await importUploadedPrivateKeyMaterial(privateJwk);
  await prisma.user.upsert({
    where: { keyId: material.keyId },
    create: {
      keyId: material.keyId,
      publicKey: parsePublicKey(slimEcPublicJwk(privateJwk)),
    },
    update: {
      publicKey: parsePublicKey(slimEcPublicJwk(privateJwk)),
    },
  });
  console.log(`Dev user ready (keyId: ${material.keyId})`);
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
  await seedDevUser();

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
