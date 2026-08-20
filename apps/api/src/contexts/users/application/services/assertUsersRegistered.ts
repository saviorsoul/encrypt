import { badRequest, forbidden } from '@/lib/httpError.js';
import { USER_STATUS_INACTIVE } from '@/contexts/users/domain/constants.js';
import { userRepository } from '@/contexts/users/infrastructure/prismaUserRepository.js';

export async function assertUsersRegistered(keyIds: string[]): Promise<void> {
  const unique = [...new Set(keyIds)];
  const statuses = await userRepository.findStatuses(unique);
  const inactive = unique.filter(
    (keyId) => statuses.get(keyId) === USER_STATUS_INACTIVE,
  );
  if (inactive.length > 0) {
    throw forbidden('This account is inactive.');
  }

  const missing = unique.filter((keyId) => !statuses.has(keyId));
  if (missing.length > 0) {
    throw badRequest(`Unknown user keyId: ${missing.join(', ')}`);
  }
}
