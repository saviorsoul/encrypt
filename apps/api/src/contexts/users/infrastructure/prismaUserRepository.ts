import type { Prisma } from '@prisma/client';
import { prisma } from '@/lib/prisma.js';
import { conflict } from '@/lib/httpError.js';
import type {
  EcPublicKey,
  UserRepository,
} from '@/contexts/users/domain/ports/UserRepository.js';
import type { RegisterUserInput } from '@/contexts/users/domain/types.js';

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

export const userRepository: UserRepository = {
  async register(input: RegisterUserInput): Promise<void> {
    try {
      await prisma.user.create({
        data: {
          keyId: input.keyId,
          publicKey: toPrismaPublicKey(input.publicKey),
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
  },

  async registerIfAbsent(input: RegisterUserInput): Promise<void> {
    const registered = await userRepository.findRegisteredKeyIds([input.keyId]);
    if (registered.has(input.keyId)) {
      return;
    }
    await userRepository.register(input);
  },

  async listUsers() {
    return prisma.user.findMany({
      select: { keyId: true, publicKey: true },
      orderBy: { createdAt: 'desc' },
    });
  },

  async findRegisteredKeyIds(keyIds: string[]): Promise<Set<string>> {
    if (keyIds.length === 0) {
      return new Set();
    }

    const rows = await prisma.user.findMany({
      where: { keyId: { in: keyIds } },
      select: { keyId: true },
    });

    return new Set(rows.map((row) => row.keyId));
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
      select: { keyId: true },
    });
    return row != null;
  },
};
