import { startTransition, useCallback } from 'react';
import { yieldToMain } from '@encrypt/core/utils/yieldToMain';

type UseFeedReloadActionOptions = {
  keyId: string | null;
  markRefreshStarted: () => void;
  onPrepareReload: () => void;
  reloadFeed: () => Promise<void>;
};

export function useFeedReloadAction({
  keyId,
  markRefreshStarted,
  onPrepareReload,
  reloadFeed,
}: UseFeedReloadActionOptions) {
  return useCallback(() => {
    if (!keyId) {
      return Promise.resolve();
    }

    return new Promise<void>((resolve, reject) => {
      window.setTimeout(() => {
        void (async () => {
          try {
            await yieldToMain();
            markRefreshStarted();
            startTransition(() => {
              onPrepareReload();
            });
            await reloadFeed();
            resolve();
          } catch (error) {
            reject(error);
          }
        })();
      }, 0);
    });
  }, [keyId, markRefreshStarted, onPrepareReload, reloadFeed]);
}
