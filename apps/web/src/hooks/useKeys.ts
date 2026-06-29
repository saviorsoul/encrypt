import { useCallback, useEffect, useRef, useState } from 'react';
import {
  exportPublicKeyJwk,
  generateExtractableEcdhKeyPair,
} from '@/crypto/ecdhKeys.ts';
import { slimEcPrivateJwk } from '@/crypto/jwkThumbprint.ts';
import {
  deleteStoredPublicKeyForUsername,
  loadPublicKeyFromStored,
  loadStoredPublicKeyMaterial,
  markPrivateKeyDownloadedForUsername,
  saveStoredPublicKeyForUsername,
} from '@/services/db/storedPublicKeys.ts';
import { markOnboardingComplete } from '@/components/providers/AuthProvider.tsx';
import { useAuth } from '@/hooks/useAuth.ts';
import { downloadJsonFile } from '@/utils/downloadJson.ts';
import { privateKeyDownloadFilename } from '@/utils/privateKeyFilename.ts';

export type UseKeysReturn = {
  loading: boolean;
  publicKey: CryptoKey | null;
  publicKeyJwk: JsonWebKey | null;
  /** True when the user must download their private key before using the app. */
  needsPrivateKeyDownload: boolean;
  /** Private JWK offered for download during first-time setup. */
  pendingPrivateKeyJwk: JsonWebKey | null;
  /** Filename for the pending private key download, if any. */
  privateKeyDownloadFilename: string | null;
  /** True after the user has downloaded and saved their private key in IndexedDB. */
  privateKeySaved: boolean;
  /** Ensure a pending private key exists for the download page. */
  ensurePendingPrivateKey: () => Promise<void>;
  /** Trigger the private key file download and mark it saved in IndexedDB. */
  downloadPendingPrivateKey: () => Promise<void>;
};

type PreparedKeys = {
  result: Awaited<ReturnType<typeof loadPublicKeyFromStored>>;
  pendingDownload: boolean;
  savedToDb: boolean;
  privateJwk: JsonWebKey | null;
  downloadFilename: string | null;
};

async function createAndPersistPublicKeyPendingDownload(
  username: string,
): Promise<{
  loaded: Awaited<ReturnType<typeof loadPublicKeyFromStored>>;
  privateJwk: JsonWebKey;
  downloadFilename: string;
}> {
  const generated = await generateExtractableEcdhKeyPair();
  const publicJwk = await exportPublicKeyJwk(generated);
  const privateJwk = slimEcPrivateJwk(
    (await crypto.subtle.exportKey('jwk', generated.privateKey)) as JsonWebKey,
  );
  const downloadFilename = privateKeyDownloadFilename(username);

  await saveStoredPublicKeyForUsername(username, publicJwk, false);

  const loaded = await loadPublicKeyFromStored(publicJwk);

  return {
    loaded,
    privateJwk,
    downloadFilename,
  };
}

async function loadExistingKeys(
  username: string,
): Promise<PreparedKeys | null> {
  const stored = await loadStoredPublicKeyMaterial(username);
  if (!stored) {
    return null;
  }

  const result = await loadPublicKeyFromStored(stored.publicJwk);
  if (stored.privateKeyDownloaded === false) {
    return {
      result,
      pendingDownload: true,
      savedToDb: false,
      privateJwk: null,
      downloadFilename: privateKeyDownloadFilename(username),
    };
  }

  return {
    result,
    pendingDownload: false,
    savedToDb: false,
    privateJwk: null,
    downloadFilename: null,
  };
}

async function ensureOnboardingKeys(username: string): Promise<PreparedKeys> {
  const stored = await loadStoredPublicKeyMaterial(username);

  if (!stored || stored.privateKeyDownloaded === false) {
    if (stored) {
      await deleteStoredPublicKeyForUsername(username);
    }
    const created = await createAndPersistPublicKeyPendingDownload(username);
    return {
      result: created.loaded,
      pendingDownload: true,
      savedToDb: false,
      privateJwk: created.privateJwk,
      downloadFilename: created.downloadFilename,
    };
  }

  const result = await loadPublicKeyFromStored(stored.publicJwk);
  return {
    result,
    pendingDownload: false,
    savedToDb: false,
    privateJwk: null,
    downloadFilename: null,
  };
}

function applyPreparedKeys(
  prepared: PreparedKeys,
  setters: {
    setPublicKey: (key: CryptoKey | null) => void;
    setPublicKeyJwk: (jwk: JsonWebKey | null) => void;
    setNeedsPrivateKeyDownload: (value: boolean) => void;
    setPrivateKeySaved: (value: boolean) => void;
    setPendingPrivateKeyJwk: (jwk: JsonWebKey | null) => void;
    setPrivateKeyDownloadFilenameState: (filename: string | null) => void;
  },
) {
  setters.setPublicKey(prepared.result.publicKey);
  setters.setPublicKeyJwk(prepared.result.publicKeyJwk);
  setters.setNeedsPrivateKeyDownload(prepared.pendingDownload);
  setters.setPrivateKeySaved(prepared.savedToDb);
  setters.setPendingPrivateKeyJwk(prepared.privateJwk);
  setters.setPrivateKeyDownloadFilenameState(prepared.downloadFilename);
}

/**
 * Browser ECDH public key + IndexedDB persistence, scoped to the logged-in user.
 * Loads existing keys on sign-in; new key pairs are created only via
 * `ensurePendingPrivateKey` on the first-time download page.
 */
export function useKeys(): UseKeysReturn {
  const { user } = useAuth();
  const [publicKey, setPublicKey] = useState<CryptoKey | null>(null);
  const [publicKeyJwk, setPublicKeyJwk] = useState<JsonWebKey | null>(null);
  const [needsPrivateKeyDownload, setNeedsPrivateKeyDownload] = useState(false);
  const [privateKeySaved, setPrivateKeySaved] = useState(false);
  const [pendingPrivateKeyJwk, setPendingPrivateKeyJwk] =
    useState<JsonWebKey | null>(null);
  const [privateKeyDownloadFilenameState, setPrivateKeyDownloadFilenameState] =
    useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const ensuringRef = useRef<Promise<PreparedKeys> | null>(null);
  const [prevUsername, setPrevUsername] = useState<string | undefined>(
    undefined,
  );

  const username = user?.username;

  function resetKeysState() {
    setPublicKey(null);
    setPublicKeyJwk(null);
    setNeedsPrivateKeyDownload(false);
    setPrivateKeySaved(false);
    setPendingPrivateKeyJwk(null);
    setPrivateKeyDownloadFilenameState(null);
    setLoading(true);
  }

  const runEnsureOnboardingKeys = useCallback(async (username: string) => {
    if (!ensuringRef.current) {
      ensuringRef.current = ensureOnboardingKeys(username).finally(() => {
        ensuringRef.current = null;
      });
    }
    return ensuringRef.current;
  }, []);

  const ensurePendingPrivateKey = useCallback(async () => {
    const username = user?.username;
    if (!username) return;

    setLoading(true);
    try {
      const prepared = await runEnsureOnboardingKeys(username);
      applyPreparedKeys(prepared, {
        setPublicKey,
        setPublicKeyJwk,
        setNeedsPrivateKeyDownload,
        setPrivateKeySaved,
        setPendingPrivateKeyJwk,
        setPrivateKeyDownloadFilenameState,
      });
    } finally {
      setLoading(false);
    }
  }, [user?.username, runEnsureOnboardingKeys]);

  if (username !== prevUsername) {
    setPrevUsername(username);
    if (!username) {
      resetKeysState();
    }
  }

  useEffect(() => {
    if (!username) {
      return;
    }

    let cancelled = false;

    async function init(activeUsername: string) {
      setLoading(true);
      try {
        const prepared = await loadExistingKeys(activeUsername);
        if (cancelled) return;
        if (prepared) {
          applyPreparedKeys(prepared, {
            setPublicKey,
            setPublicKeyJwk,
            setNeedsPrivateKeyDownload,
            setPrivateKeySaved,
            setPendingPrivateKeyJwk,
            setPrivateKeyDownloadFilenameState,
          });
          if (!prepared.pendingDownload) {
            markOnboardingComplete();
          }
          return;
        }

        setPublicKey(null);
        setPublicKeyJwk(null);
        setNeedsPrivateKeyDownload(false);
        setPrivateKeySaved(false);
        setPendingPrivateKeyJwk(null);
        setPrivateKeyDownloadFilenameState(null);
      } catch {
        if (!cancelled) {
          setPublicKey(null);
          setPublicKeyJwk(null);
          setNeedsPrivateKeyDownload(false);
          setPrivateKeySaved(false);
          setPendingPrivateKeyJwk(null);
          setPrivateKeyDownloadFilenameState(null);
        }
      } finally {
        if (!cancelled) {
          setLoading(false);
        }
      }
    }

    void init(username);

    return () => {
      cancelled = true;
    };
  }, [username]);

  const downloadPendingPrivateKey = useCallback(async () => {
    const username = user?.username;
    if (!username || !pendingPrivateKeyJwk) {
      throw new Error('No private key is available to download.');
    }

    const filename =
      privateKeyDownloadFilenameState ?? privateKeyDownloadFilename(username);
    downloadJsonFile(pendingPrivateKeyJwk, filename);
    await markPrivateKeyDownloadedForUsername(username);

    setPrivateKeySaved(true);
    setPendingPrivateKeyJwk(null);
  }, [user?.username, pendingPrivateKeyJwk, privateKeyDownloadFilenameState]);

  return {
    loading,
    publicKey,
    publicKeyJwk,
    needsPrivateKeyDownload,
    privateKeySaved,
    pendingPrivateKeyJwk,
    privateKeyDownloadFilename: privateKeyDownloadFilenameState,
    ensurePendingPrivateKey,
    downloadPendingPrivateKey,
  };
}
