import { badRequest } from '@/lib/httpError.js';
import { USER_STATUS_INACTIVE } from '@/contexts/users/domain/constants.js';
import { userRepository } from '@/contexts/users/infrastructure/prismaUserRepository.js';

/** Other users (e.g. friend-request target). Missing or inactive → 400. */
export async function assertUsersRegistered(keyIds: string[]): Promise<void> {
  const unique = [...new Set(keyIds)];
  const statuses = await userRepository.findStatuses(unique);
  const missing = unique.filter((keyId) => {
    const status = statuses.get(keyId);
    return !status || status === USER_STATUS_INACTIVE;
  });
  if (missing.length > 0) {
    throw badRequest(`Unknown user keyId: ${missing.join(', ')}`);
  }
}
