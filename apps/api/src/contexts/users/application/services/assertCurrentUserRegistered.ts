import { badRequest, forbidden } from '@/lib/httpError.js';
import { USER_STATUS_INACTIVE } from '@/contexts/users/domain/constants.js';
import { userRepository } from '@/contexts/users/infrastructure/prismaUserRepository.js';

/** Signed-in key (`authenticatedKeyId`). Inactive → 403; unknown → 400. */
export async function assertCurrentUserRegistered(
  keyId: string,
): Promise<void> {
  const statuses = await userRepository.findStatuses([keyId]);
  const status = statuses.get(keyId);
  if (status === USER_STATUS_INACTIVE) {
    throw forbidden('This account is inactive.');
  }
  if (!status) {
    throw badRequest(`Unknown user keyId: ${keyId}`);
  }
}
