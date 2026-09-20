import { loadFeedLabUserByUsername } from '@lab/services/db/storedUsers.ts';

const DEFAULT_INVITE_USERNAME = 'my';

/** Local feed-lab name for a self-generated invite key pair. */
export async function resolveDefaultInviteUsername(
  ownerKeyId: string | null,
): Promise<string> {
  if (!ownerKeyId) {
    return DEFAULT_INVITE_USERNAME;
  }

  if (!(await loadFeedLabUserByUsername(ownerKeyId, DEFAULT_INVITE_USERNAME))) {
    return DEFAULT_INVITE_USERNAME;
  }

  let suffix = 2;
  while (true) {
    const candidate = `${DEFAULT_INVITE_USERNAME}-${suffix}`;
    if (!(await loadFeedLabUserByUsername(ownerKeyId, candidate))) {
      return candidate;
    }
    suffix += 1;
  }
}
