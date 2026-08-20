import { afterEach, describe, expect, it, vi } from 'vitest';
import { userRepository } from '@/contexts/users/infrastructure/prismaUserRepository.js';
import { USER_STATUS_INACTIVE } from '@/contexts/users/domain/constants.js';

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

describe('userRepository.registerIfAbsent', () => {
  afterEach(() => {
    vi.clearAllMocks();
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
