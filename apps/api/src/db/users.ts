import type { Prisma } from '@prisma/client';
import { prisma } from '../lib/prisma.js';
import { badRequest, conflict } from '../lib/httpError.js';

export type RegisterUserInput = {
  keyId: string;
  publicKey: Prisma.InputJsonValue;
};

export async function registerUser(input: RegisterUserInput) {
  try {
    return await prisma.user.create({
      data: {
        keyId: input.keyId,
        publicKey: input.publicKey,
      },
    });
  } catch (error) {
    if (
      error instanceof Error &&
      'code' in error &&
      (error as { code: string }).code === 'P2002'
    ) {
      throw conflict(`User already exists: ${input.keyId}`);
    }
    throw error;
  }
}

export async function registerUserIfAbsent(
  input: RegisterUserInput,
): Promise<void> {
  const registered = await findRegisteredKeyIds([input.keyId]);
  if (registered.has(input.keyId)) {
    return;
  }
  await registerUser(input);
}

export async function listUsers() {
  return prisma.user.findMany({
    select: { keyId: true, publicKey: true },
    orderBy: { createdAt: 'desc' },
  });
}

export async function findRegisteredKeyIds(
  keyIds: string[],
): Promise<Set<string>> {
  if (keyIds.length === 0) {
    return new Set();
  }

  const rows = await prisma.user.findMany({
    where: { keyId: { in: keyIds } },
    select: { keyId: true },
  });

  return new Set(rows.map((row) => row.keyId));
}

/** Reject when any manifest recipient is not registered in users. */
export async function assertRecipientsRegistered(
  recipientKeyIds: string[],
): Promise<void> {
  const unique = [...new Set(recipientKeyIds)];
  const registered = await findRegisteredKeyIds(unique);
  const missing = unique.filter((keyId) => !registered.has(keyId));

  if (missing.length > 0) {
    throw badRequest(`Unknown recipient keyId: ${missing.join(', ')}`);
  }
}
