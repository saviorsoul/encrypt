import { useContext } from 'react';
import { KeysContext } from '@/components/providers/KeysProvider.tsx';

export function useKeysContext() {
  const ctx = useContext(KeysContext);
  if (!ctx) {
    throw new Error('useKeysContext must be used within KeysProvider');
  }
  return ctx;
}
