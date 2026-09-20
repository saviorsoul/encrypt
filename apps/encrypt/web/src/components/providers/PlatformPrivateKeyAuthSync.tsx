import { useEffect } from 'react';
import { useAuth } from '@/hooks/useAuth.ts';
import { useKeysContext } from '@/hooks/useKeysContext.ts';
import { ecPublicJwkThumbprintSha256 } from '@/crypto/jwkThumbprint.ts';
import { isCapacitorApp } from '@/utils/isCapacitorApp.ts';

export function CapacitorPrivateKeyAuthSync() {
  const { user } = useAuth();
  const { publicKeyJwk } = useKeysContext();

  useEffect(() => {
    if (!isCapacitorApp()) {
      return;
    }

    let cancelled = false;

    void (async () => {
      const keyId =
        user && publicKeyJwk
          ? await ecPublicJwkThumbprintSha256(publicKeyJwk)
          : null;
      if (cancelled) {
        return;
      }

      window.capacitorBridge?.setAuthState({
        isLoggedIn: Boolean(user),
        keyId,
      });
    })();

    return () => {
      cancelled = true;
    };
  }, [publicKeyJwk, user]);

  return null;
}
