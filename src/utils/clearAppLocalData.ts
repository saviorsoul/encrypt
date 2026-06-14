import {
  LAST_USERNAME_STORAGE_KEY,
  SESSION_USER_STORAGE_KEY,
} from '@/components/providers/AuthProvider.tsx';
import { deleteCryptoDb } from '@/services/db/cryptoDb.ts';

function clearAuthStorage(): void {
  try {
    sessionStorage.removeItem(SESSION_USER_STORAGE_KEY);
    localStorage.removeItem(LAST_USERNAME_STORAGE_KEY);
  } catch {
    /* ignore quota / privacy mode */
  }
}

export async function clearAppLocalData(): Promise<void> {
  clearAuthStorage();
  await deleteCryptoDb();
}
