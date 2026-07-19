import { badRequest } from '@/lib/httpError.js';
import { userRepository } from '@/contexts/users/infrastructure/prismaUserRepository.js';

/** Reject when any manifest recipient is not registered in users. */
export async function assertRecipientsRegistered(
  recipientKeyIds: string[],
): Promise<void> {
  const unique = [...new Set(recipientKeyIds)];
  const registered = await userRepository.findRegisteredKeyIds(unique);
  const missing = unique.filter((keyId) => !registered.has(keyId));

  if (missing.length > 0) {
    throw badRequest(`Unknown recipient keyId: ${missing.join(', ')}`);
  }
}
