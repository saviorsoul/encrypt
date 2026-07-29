import { useEffect, useMemo } from 'react';
import { useAuth } from '@/hooks/useAuth.ts';
import { useKeysContext } from '@/hooks/useKeysContext.ts';
import { useStoredUsernames } from '@/hooks/useStoredUsernames.ts';
import { formatEcPublicKeyText } from '@/crypto/ecPublicKey.ts';
import { ecPublicJwkThumbprintSha256 } from '@/crypto/jwkThumbprint.ts';

export function ElectronTraySync() {
  const { user } = useAuth();
  const { publicKeyJwk, loading } = useKeysContext();
  const { usernames, loading: loadingRecipients } = useStoredUsernames();

  const canExportPublicKey = Boolean(user && publicKeyJwk && !loading);

  const publicKeyText = useMemo(() => {
    if (!canExportPublicKey || !publicKeyJwk) {
      return null;
    }

    return formatEcPublicKeyText(publicKeyJwk);
  }, [canExportPublicKey, publicKeyJwk]);

  useEffect(() => {
    let cancelled = false;

    void (async () => {
      const keyId =
        user && publicKeyJwk
          ? await ecPublicJwkThumbprintSha256(publicKeyJwk)
          : null;
      if (cancelled) {
        return;
      }

      window.electron?.setTrayAuthState({
        canExportPublicKey,
        publicKeyText,
        isLoggedIn: Boolean(user),
        keyId,
      });
    })();

    return () => {
      cancelled = true;
    };
  }, [canExportPublicKey, publicKeyText, publicKeyJwk, user]);

  useEffect(() => {
    window.electron?.setTrayRecipients({
      usernames: loadingRecipients ? [] : usernames,
    });
  }, [loadingRecipients, usernames]);

  return null;
}
