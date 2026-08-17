import { unlink } from 'node:fs/promises';
import '@api/loadEnv.js';
import { prisma } from '@api/lib/prisma.ts';
import type { EphemeralPrivateKey } from './test.ts';
import { deleteUsers } from './e2eDbSeed.ts';
import { REGISTERED_EPHEMERAL_PRIVATE_KEY_PATH } from './e2eKeysPath.ts';
import { loadTestKeyMaterialFromFile } from './testKeys.ts';

export async function isRegisteredEphemeralUserSeeded(): Promise<boolean> {
  try {
    const material = await loadTestKeyMaterialFromFile(
      REGISTERED_EPHEMERAL_PRIVATE_KEY_PATH,
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

export async function loadRegisteredEphemeralUser(): Promise<EphemeralPrivateKey | null> {
  try {
    const material = await loadTestKeyMaterialFromFile(
      REGISTERED_EPHEMERAL_PRIVATE_KEY_PATH,
    );
    return {
      filePath: REGISTERED_EPHEMERAL_PRIVATE_KEY_PATH,
      keyId: material.keyId,
      material,
    };
  } catch {
    return null;
  }
}

export async function clearRegisteredEphemeralUser(): Promise<void> {
  try {
    await unlink(REGISTERED_EPHEMERAL_PRIVATE_KEY_PATH);
  } catch {
    // Key file may not exist.
  }
}

/** Remove ephemeral user row and key file after the USERS e2e chain. */
export async function clearRegisteredEphemeralUserFixture(): Promise<void> {
  try {
    const material = await loadTestKeyMaterialFromFile(
      REGISTERED_EPHEMERAL_PRIVATE_KEY_PATH,
    );
    await deleteUsers([material.keyId]);
  } catch {
    // Key file missing or unreadable — nothing to delete from DB.
  }
  await clearRegisteredEphemeralUser();
}
