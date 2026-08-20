import type { Prisma } from '@prisma/client';
import { prisma, type PrismaTx } from '@/lib/prisma.js';
import { conflict, forbidden } from '@/lib/httpError.js';
import type {
  EcPublicKey,
  UserRepository,
} from '@/contexts/users/domain/ports/UserRepository.js';
import type { RegisterUserInput } from '@/contexts/users/domain/types.js';
import {
  USER_STATUS_ACTIVE,
  USER_STATUS_INACTIVE,
} from '@/contexts/users/domain/constants.js';

function toPrismaPublicKey(
  publicKey: RegisterUserInput['publicKey'],
): Prisma.InputJsonValue {
  return publicKey as Prisma.InputJsonValue;
}

function parseEcPublicKey(value: unknown): EcPublicKey | null {
  if (!value || typeof value !== 'object') {
    return null;
  }
  const record = value as Record<string, unknown>;
  if (typeof record.x !== 'string' || typeof record.y !== 'string') {
    return null;
  }
  return { x: record.x, y: record.y };
}

function isInactiveAccountError(error: unknown): boolean {
  return (
    error instanceof Error &&
    'code' in error &&
    (error as { code: string }).code === 'P2002'
  );
}

export async function markUserInactive(
  keyId: string,
  tx?: PrismaTx,
): Promise<void> {
  const client = tx ?? prisma;
  await client.user.updateMany({
    where: { keyId },
    data: { status: USER_STATUS_INACTIVE },
  });
}

export const userRepository: UserRepository = {
  async register(input: RegisterUserInput): Promise<void> {
    try {
      await prisma.user.create({
        data: {
          keyId: input.keyId,
          publicKey: toPrismaPublicKey(input.publicKey),
          status: USER_STATUS_ACTIVE,
        },
      });
    } catch (error) {
      if (isInactiveAccountError(error)) {
        const existing = await prisma.user.findUnique({
          where: { keyId: input.keyId },
          select: { status: true },
        });
        if (existing?.status === USER_STATUS_INACTIVE) {
          throw forbidden('This key cannot be used to create a new account.');
        }
        throw conflict(`User already exists: ${input.keyId}`);
      }
      throw error;
    }
  },

  async registerIfAbsent(input: RegisterUserInput): Promise<void> {
    const existing = await prisma.user.findUnique({
      where: { keyId: input.keyId },
      select: { status: true },
    });
    if (existing?.status === USER_STATUS_ACTIVE) {
      return;
    }
    if (existing?.status === USER_STATUS_INACTIVE) {
      throw forbidden('This key cannot be used to create a new account.');
    }
    await userRepository.register(input);
  },

  async findRegisteredKeyIds(keyIds: string[]): Promise<Set<string>> {
    if (keyIds.length === 0) {
      return new Set();
    }

    const rows = await prisma.user.findMany({
      where: { keyId: { in: keyIds }, status: USER_STATUS_ACTIVE },
      select: { keyId: true },
    });

    return new Set(rows.map((row) => row.keyId));
  },

  async findStatuses(keyIds: string[]): Promise<Map<string, string>> {
    if (keyIds.length === 0) {
      return new Map();
    }

    const rows = await prisma.user.findMany({
      where: { keyId: { in: keyIds } },
      select: { keyId: true, status: true },
    });

    return new Map(rows.map((row) => [row.keyId, row.status]));
  },

  async findPublicKeysByKeyIds(
    keyIds: string[],
  ): Promise<Map<string, EcPublicKey>> {
    if (keyIds.length === 0) {
      return new Map();
    }

    const rows = await prisma.user.findMany({
      where: { keyId: { in: keyIds } },
      select: { keyId: true, publicKey: true },
    });

    const result = new Map<string, EcPublicKey>();
    for (const row of rows) {
      const publicKey = parseEcPublicKey(row.publicKey);
      if (publicKey) {
        result.set(row.keyId, publicKey);
      }
    }
    return result;
  },

  async exists(keyId: string): Promise<boolean> {
    const row = await prisma.user.findUnique({
      where: { keyId },
      select: { status: true },
    });
    return row?.status === USER_STATUS_ACTIVE;
  },

  async markInactive(keyId: string, tx?: PrismaTx): Promise<void> {
    await markUserInactive(keyId, tx);
  },
};
