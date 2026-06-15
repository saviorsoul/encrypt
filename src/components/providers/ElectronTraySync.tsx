import { useEffect, useMemo } from 'react';
import { useAuth } from '@/hooks/useAuth.ts';
import { useKeysContext } from '@/hooks/useKeysContext.ts';
import { slimEcPublicJwk } from '@/crypto/jwkThumbprint.ts';

export function ElectronTraySync() {
  const { user } = useAuth();
  const { publicKeyJwk, loading } = useKeysContext();

  const canExportPublicKey = Boolean(user && publicKeyJwk && !loading);

  const publicKeyText = useMemo(() => {
    if (!canExportPublicKey || !publicKeyJwk) {
      return null;
    }

    return JSON.stringify(slimEcPublicJwk(publicKeyJwk), null, 2);
  }, [canExportPublicKey, publicKeyJwk]);

  useEffect(() => {
    window.electron?.setTrayAuthState({
      canExportPublicKey,
      publicKeyText,
    });
  }, [canExportPublicKey, publicKeyText]);

  return null;
}
