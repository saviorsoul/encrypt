import { clearAuthStorage } from '@/components/providers/AuthProvider.tsx';
import { deleteCryptoDb } from '@/services/db/cryptoDb.ts';
import { clearLastOneToOneRecipientStorage } from '@/utils/lastOneToOneRecipient.ts';

export async function clearAppLocalData(): Promise<void> {
  clearAuthStorage();
  clearLastOneToOneRecipientStorage();
  await deleteCryptoDb();
}
