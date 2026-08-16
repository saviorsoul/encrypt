import {
  createContext,
  useCallback,
  useContext,
  useMemo,
  useState,
  type ReactNode,
} from 'react';
import type { AuthPublicKeyCoords } from '@encrypt/core/crypto/authProof';
import {
  createFeedApiAuthProvider,
  type FeedApiAuthProvider,
} from '@encrypt/core/api/feedApiAuth';
import { getCachedPrivateKeyMaterial } from '@encrypt/platform/sessionPrivateKeyStorage';
import {
  importPrivateKeyToSafeStorage,
  isPrivateKeyImportSelectionCancelled,
  unlockPrivateKeyMaterialFromSafeStorage,
} from '@encrypt/platform/feednt';
import { setActivePrivateKeyId } from '@encrypt/platform/activePrivateKeyId';
import { setPrivateKeySafeStorageAuthState } from '@encrypt/platform/privateKeySafeStorageSession';
import { getChallengeUrl } from '@feednt/lib/apiBaseUrl.ts';
import { useFeedntPrivateKey } from '@feednt/hooks/useFeedntPrivateKey.ts';
import { useFeedntUsers } from '@feednt/hooks/useFeedntUsers.ts';
import { usePlatformPrivateKey } from '@feednt/providers/PlatformProvider.tsx';

export type FeedntSession = {
  keyId: string;
  publicKey: AuthPublicKeyCoords;
  authProvider: FeedApiAuthProvider;
};

type FeedntSessionContextValue = {
  session: FeedntSession | null;
  sessionError: string | null;
  keys: ReturnType<typeof useFeedntPrivateKey>;
  feedntUsers: ReturnType<typeof useFeedntUsers>;
  unlock: () => Promise<boolean>;
  importKey: () => Promise<boolean>;
  signOut: () => void;
  clearSessionError: () => void;
};

const FeedntSessionContext = createContext<FeedntSessionContextValue | null>(
  null,
);

function createSessionFromMaterial(
  material: NonNullable<ReturnType<typeof getCachedPrivateKeyMaterial>>,
): FeedntSession {
  const authProvider = createFeedApiAuthProvider(
    async () => getCachedPrivateKeyMaterial(),
    { challengeUrl: getChallengeUrl() },
  );
  return {
    keyId: material.keyId,
    publicKey: material.publicKey,
    authProvider,
  };
}

export function FeedntSessionProvider({ children }: { children: ReactNode }) {
  const platformPrivateKey = usePlatformPrivateKey();
  const [session, setSession] = useState<FeedntSession | null>(() => {
    const cached = getCachedPrivateKeyMaterial();
    if (!cached) {
      return null;
    }
    setActivePrivateKeyId(cached.keyId);
    setPrivateKeySafeStorageAuthState({
      isLoggedIn: true,
      keyId: cached.keyId,
    });
    return createSessionFromMaterial(cached);
  });
  const [sessionError, setSessionError] = useState<string | null>(null);
  const keys = useFeedntPrivateKey(session?.keyId ?? null);
  const feedntUsers = useFeedntUsers(session?.keyId ?? null);

  const clearSessionError = useCallback(() => {
    setSessionError(null);
  }, []);

  const signOut = useCallback(() => {
    platformPrivateKey.clearStorage();
    setActivePrivateKeyId(null);
    setPrivateKeySafeStorageAuthState({ isLoggedIn: false, keyId: null });
    setSession(null);
  }, [platformPrivateKey]);

  const unlock = useCallback(async (): Promise<boolean> => {
    setSessionError(null);
    try {
      const material = await unlockPrivateKeyMaterialFromSafeStorage();
      setActivePrivateKeyId(material.keyId);
      setPrivateKeySafeStorageAuthState({
        isLoggedIn: true,
        keyId: material.keyId,
      });
      setSession(createSessionFromMaterial(material));
      return true;
    } catch (error) {
      const message =
        error instanceof Error
          ? error.message
          : 'Failed to unlock private key from secure storage.';
      setSessionError(message);
      return false;
    }
  }, []);

  const importKey = useCallback(async (): Promise<boolean> => {
    setSessionError(null);
    try {
      const material = await importPrivateKeyToSafeStorage();
      setActivePrivateKeyId(material.keyId);
      setPrivateKeySafeStorageAuthState({
        isLoggedIn: true,
        keyId: material.keyId,
      });
      setSession(createSessionFromMaterial(material));
      return true;
    } catch (error) {
      if (isPrivateKeyImportSelectionCancelled(error)) {
        return false;
      }
      const message =
        error instanceof Error
          ? error.message
          : 'Failed to import private key into secure storage.';
      setSessionError(message);
      return false;
    }
  }, []);

  const value = useMemo(
    () => ({
      session,
      sessionError,
      keys,
      feedntUsers,
      unlock,
      importKey,
      signOut,
      clearSessionError,
    }),
    [
      session,
      sessionError,
      keys,
      feedntUsers,
      unlock,
      importKey,
      signOut,
      clearSessionError,
    ],
  );

  return (
    <FeedntSessionContext.Provider value={value}>
      {children}
    </FeedntSessionContext.Provider>
  );
}

export function useFeedntSession(): FeedntSessionContextValue {
  const context = useContext(FeedntSessionContext);
  if (!context) {
    throw new Error(
      'useFeedntSession must be used within FeedntSessionProvider',
    );
  }
  return context;
}
