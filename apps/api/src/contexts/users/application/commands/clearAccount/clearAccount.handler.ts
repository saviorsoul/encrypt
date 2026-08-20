import { eraseAccountData } from '@/contexts/users/application/services/eraseAccountData.js';

export type ClearAccountCommand = {
  keyId: string;
};

export async function handleClearAccount(
  command: ClearAccountCommand,
): Promise<void> {
  await eraseAccountData(command.keyId);
}
