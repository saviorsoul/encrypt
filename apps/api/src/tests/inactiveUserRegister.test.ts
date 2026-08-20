import { afterEach, describe, expect, it, vi } from 'vitest';
import { userRepository } from '@/contexts/users/infrastructure/prismaUserRepository.js';
import {
  USER_STATUS_ACTIVE,
  USER_STATUS_INACTIVE,
} from '@/contexts/users/domain/constants.js';

const prismaMocks = vi.hoisted(() => ({
  user: {
    create: vi.fn(),
    findUnique: vi.fn(),
    findMany: vi.fn(),
    updateMany: vi.fn(),
  },
}));

vi.mock('@/lib/prisma.js', () => ({
  prisma: prismaMocks,
}));

describe('userRepository inactive accounts', () => {
  afterEach(() => {
    vi.clearAllMocks();
  });

  it('does not return public keys for inactive users', async () => {
    prismaMocks.user.findMany.mockResolvedValue([]);

    const result = await userRepository.findPublicKeysByKeyIds(['inactive-key']);

    expect(result.size).toBe(0);
    expect(prismaMocks.user.findMany).toHaveBeenCalledWith({
      where: { keyId: { in: ['inactive-key'] }, status: USER_STATUS_ACTIVE },
      select: { keyId: true, publicKey: true },
    });
  });

  it('rejects creating a new account with an inactive key', async () => {
    prismaMocks.user.findUnique.mockResolvedValue({
      status: USER_STATUS_INACTIVE,
    });

    await expect(
      userRepository.registerIfAbsent({
        keyId: 'inactive-key',
        publicKey: { x: 'x', y: 'y' },
      }),
    ).rejects.toMatchObject({
      status: 403,
      message: 'This key cannot be used to create a new account.',
    });
    expect(prismaMocks.user.create).not.toHaveBeenCalled();
  });
});
