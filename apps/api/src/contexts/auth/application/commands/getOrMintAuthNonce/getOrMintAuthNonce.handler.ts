import type { AuthNonceEntry } from '@/contexts/auth/domain/ports/AuthNonceStore.js';
import { getOrMintAuthNonce } from '@/contexts/auth/infrastructure/authNonceStore.js';

export type GetOrMintAuthNonceCommand = {
  keyId: string;
};

export async function handleGetOrMintAuthNonce(
  command: GetOrMintAuthNonceCommand,
): Promise<AuthNonceEntry> {
  return getOrMintAuthNonce(command.keyId);
}
