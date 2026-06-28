import { clearAuthStorage } from '@/components/providers/AuthProvider.tsx';
import { deleteCryptoDb } from '@/services/db/cryptoDb.ts';
import { clearLastOneToOneRecipientStorage } from '@/utils/lastOneToOneRecipient.ts';
import { clearSessionPrivateKeyStorage } from '@/crypto/sessionPrivateKeyStorage.ts';
import { clearSessionPrivateKeyStoragePreference } from '@/utils/sessionPrivateKeyPreference.ts';

export async function clearAppLocalData(): Promise<void> {
  clearAuthStorage();
  clearLastOneToOneRecipientStorage();
  clearSessionPrivateKeyStoragePreference();
  clearSessionPrivateKeyStorage();
  await deleteCryptoDb();
}
