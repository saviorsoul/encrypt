import { useEffect } from 'react';
import { handleFeedApiAuthStorageEvent } from '@encrypt/core/api/feedApiAuth';

export function useFeedApiAuthStorageSync(): void {
  useEffect(() => {
    const onStorage = (event: StorageEvent) => {
      handleFeedApiAuthStorageEvent(event);
    };
    window.addEventListener('storage', onStorage);
    return () => {
      window.removeEventListener('storage', onStorage);
    };
  }, []);
}
