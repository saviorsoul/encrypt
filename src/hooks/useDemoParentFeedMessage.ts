import { useEffect, useState } from 'react';
import { useKeysContext } from '@/hooks/useKeysContext.ts';
import {
  loadDemoParentFeedMessage,
  type DemoParentFeedMessage,
} from '@/crypto/demoFeedCommentPoC.ts';

export function useDemoParentFeedMessage() {
  const keys = useKeysContext();
  const [demo, setDemo] = useState<DemoParentFeedMessage | null>(null);
  const [error, setError] = useState<string | null>(null);

  const keysReady = Boolean(keys?.publicKey);
  const loading =
    Boolean(keys?.loading ?? true) ||
    (keysReady && demo === null && error === null);

  useEffect(() => {
    if (!keysReady || !keys?.publicKey) {
      return;
    }

    let cancelled = false;

    loadDemoParentFeedMessage(keys.publicKey)
      .then((next) => {
        if (!cancelled) {
          setDemo(next);
          setError(null);
        }
      })
      .catch((e) => {
        if (!cancelled) {
          setDemo(null);
          setError(
            e instanceof Error
              ? e.message
              : 'Failed to prepare demo feed post.',
          );
        }
      });

    return () => {
      cancelled = true;
    };
  }, [keys?.publicKey, keysReady]);

  return { demo, loading, error, keysReady };
}
