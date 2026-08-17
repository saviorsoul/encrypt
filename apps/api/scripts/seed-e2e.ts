import { mkdir, readFile, writeFile } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';
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
import { seedFriendship } from './seed-friendship.js';

const E2E_INVITER_KEY_FILENAME = 'e2e-inviter-private-key.json';
const E2E_ORPHAN_FRIEND_PUBLIC_FILENAME = 'e2e-orphan-friend-public.json';
const KEYS_DIR = path.resolve(
  path.dirname(fileURLToPath(import.meta.url)),
  '../keys',
);

async function readPrivateJwkFromPath(
  keyPath: string,
): Promise<JsonWebKey | null> {
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

async function seedE2eOrphanFriend(): Promise<string> {
  await mkdir(KEYS_DIR, { recursive: true });
  const keyPath = path.join(KEYS_DIR, E2E_ORPHAN_FRIEND_PUBLIC_FILENAME);

  let publicJwk: JsonWebKey;
  try {
    publicJwk = slimEcPublicJwk(
      JSON.parse(await readFile(keyPath, 'utf8')) as JsonWebKey,
    );
    console.log(`Reusing e2e orphan friend public key at ${keyPath}`);
  } catch (error) {
    if ((error as NodeJS.ErrnoException).code !== 'ENOENT') {
      throw error;
    }
    const keyPair = await crypto.subtle.generateKey(
      { name: 'ECDSA', namedCurve: 'P-256' },
      true,
      ['sign', 'verify'],
    );
    publicJwk = slimEcPublicJwk(
      await crypto.subtle.exportKey('jwk', keyPair.publicKey),
    );
    await writeFile(keyPath, `${JSON.stringify(publicJwk, null, 2)}\n`, 'utf8');
    console.log(`Wrote e2e orphan friend public key to ${keyPath}`);
  }

  const keyId = await ecPublicJwkThumbprintSha256(publicJwk);
  await prisma.user.upsert({
    where: { keyId },
    create: {
      keyId,
      publicKey: parsePublicKey(publicJwk),
    },
    update: {
      publicKey: parsePublicKey(publicJwk),
    },
  });
  console.log(`E2e orphan friend ready (keyId: ${keyId})`);
  return keyId;
}

export async function seedE2eInviter(): Promise<string> {
  await mkdir(KEYS_DIR, { recursive: true });
  const keyPath = path.join(KEYS_DIR, E2E_INVITER_KEY_FILENAME);

  let privateJwk = await readPrivateJwkFromPath(keyPath);
  if (privateJwk) {
    console.log(`Reusing e2e inviter private key at ${keyPath}`);
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
    console.log(`Wrote e2e inviter private key to ${keyPath}`);
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

  const orphanFriendKeyId = await seedE2eOrphanFriend();
  await seedFriendship(material.keyId, orphanFriendKeyId);
  console.log(
    `E2e inviter ready (keyId: ${material.keyId}) with orphan friend ${orphanFriendKeyId}`,
  );
  return material.keyId;
}

async function main(): Promise<void> {
  await seedE2eInviter();
}

const isMainModule =
  typeof process.argv[1] === 'string' &&
  import.meta.url === pathToFileURL(process.argv[1]).href;

if (isMainModule) {
  main()
    .catch((error) => {
      console.error(error);
      process.exit(1);
    })
    .finally(async () => {
      await prisma.$disconnect();
    });
}
