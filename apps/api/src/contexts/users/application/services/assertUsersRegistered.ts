import { badRequest } from '@/lib/httpError.js';
import { userRepository } from '@/contexts/users/infrastructure/prismaUserRepository.js';

export async function assertUsersRegistered(keyIds: string[]): Promise<void> {
  const unique = [...new Set(keyIds)];
  const registered = await userRepository.findRegisteredKeyIds(unique);
  const missing = unique.filter((keyId) => !registered.has(keyId));

  if (missing.length > 0) {
    throw badRequest(`Unknown user keyId: ${missing.join(', ')}`);
  }
}
