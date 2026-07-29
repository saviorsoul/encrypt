import { useEffect, useRef } from 'react';
import { setActivePrivateKeyId } from '@/crypto/activePrivateKeyId.ts';
import {
  hasElectronStoredPrivateKey,
  isElectronKeychainLockedError,
  isElectronPrivateKeyEncryptionAvailable,
  warmSessionPrivateKeyFromSafeStorage,
} from '@/crypto/electronSafeStoragePrivateKey.ts';
import {
  importElectronPrivateKeyFromFile,
  isPrivateKeyFileSelectionCancelled,
} from '@/crypto/privateKeyFile.ts';
import { ecPublicJwkThumbprintSha256 } from '@/crypto/jwkThumbprint.ts';
import { getCachedPrivateKeyMaterial } from '@/crypto/sessionPrivateKeyStorage.ts';
import { useAuth } from '@/hooks/useAuth.ts';
import { useKeysContext } from '@/hooks/useKeysContext.ts';

export function ElectronPrivateKeyWarmup() {
  const { user } = useAuth();
  const keys = useKeysContext();
  const importAttemptedForKeyIdRef = useRef<string | null>(null);

  useEffect(() => {
    const publicKeyJwk = keys?.publicKeyJwk;
    if (!publicKeyJwk) {
      setActivePrivateKeyId(null);
      return;
    }

    let cancelled = false;

    async function syncActiveKeyId(jwk: JsonWebKey) {
      const keyId = await ecPublicJwkThumbprintSha256(jwk);
      if (!cancelled) {
        setActivePrivateKeyId(keyId);
      }
    }

    syncActiveKeyId(publicKeyJwk).catch(console.error);

    return () => {
      cancelled = true;
      setActivePrivateKeyId(null);
    };
  }, [keys?.publicKeyJwk]);

  useEffect(() => {
    if (
      !user?.username ||
      !keys?.publicKeyJwk ||
      keys.needsPrivateKeyDownload
    ) {
      return;
    }

    let cancelled = false;
    const publicKeyJwk = keys.publicKeyJwk;

    async function warmupPrivateKey() {
      const keyId = await ecPublicJwkThumbprintSha256(publicKeyJwk);
      if (cancelled) {
        return;
      }

      if (getCachedPrivateKeyMaterial()?.keyId === keyId) {
        return;
      }

      const warmed = await warmSessionPrivateKeyFromSafeStorage(keyId);
      if (cancelled || warmed) {
        return;
      }

      const encryptionAvailable =
        await isElectronPrivateKeyEncryptionAvailable();
      if (cancelled || !encryptionAvailable) {
        return;
      }

      try {
        if (await hasElectronStoredPrivateKey(keyId)) {
          return;
        }
      } catch (error) {
        if (
          isElectronKeychainLockedError(error) ||
          getCachedPrivateKeyMaterial()?.keyId === keyId
        ) {
          return;
        }
        throw error;
      }

      if (cancelled) {
        return;
      }

      if (importAttemptedForKeyIdRef.current === keyId) {
        return;
      }
      importAttemptedForKeyIdRef.current = keyId;

      try {
        await importElectronPrivateKeyFromFile(keyId);
      } catch (error) {
        if (!isPrivateKeyFileSelectionCancelled(error)) {
          console.error(error);
        }
      }
    }

    warmupPrivateKey().catch((error) => {
      if (!isPrivateKeyFileSelectionCancelled(error)) {
        console.error(error);
      }
    });

    return () => {
      cancelled = true;
    };
  }, [keys?.needsPrivateKeyDownload, keys?.publicKeyJwk, user?.username]);

  return null;
}
