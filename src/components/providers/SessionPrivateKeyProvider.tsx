import React, {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
  type ReactNode,
} from 'react';
import { clearSessionPrivateKeyStorage } from '@/crypto/sessionPrivateKeyStorage.ts';
import {
  initSessionPrivateKeyStoragePreference,
  setSessionPrivateKeyStorageEnabled,
} from '@/utils/sessionPrivateKeyPreference.ts';
import { useAuth } from '@/hooks/useAuth.ts';

export type SessionPrivateKeyContextValue = {
  storageEnabled: boolean;
  setStorageEnabled: (enabled: boolean) => void;
};

export const SessionPrivateKeyContext =
  createContext<SessionPrivateKeyContextValue | null>(null);

export function SessionPrivateKeyProvider({
  children,
}: {
  children: ReactNode;
}) {
  const { user } = useAuth();
  const previousUserRef = useRef(user);
  const [storageEnabled, setStorageEnabledState] = useState(() =>
    initSessionPrivateKeyStoragePreference(),
  );

  const setStorageEnabled = useCallback((enabled: boolean) => {
    setSessionPrivateKeyStorageEnabled(enabled);
    setStorageEnabledState(enabled);
    if (!enabled) {
      clearSessionPrivateKeyStorage();
    }
  }, []);

  useEffect(() => {
    const previousUser = previousUserRef.current;
    previousUserRef.current = user;
    if (previousUser && !user) {
      clearSessionPrivateKeyStorage();
    }
  }, [user]);

  const value = useMemo(
    () => ({
      storageEnabled,
      setStorageEnabled,
    }),
    [storageEnabled, setStorageEnabled],
  );

  return (
    <SessionPrivateKeyContext value={value}>
      {children}
    </SessionPrivateKeyContext>
  );
}

export function useSessionPrivateKeyPreference(): SessionPrivateKeyContextValue {
  const ctx = useContext(SessionPrivateKeyContext);
  if (!ctx) {
    throw new Error(
      'useSessionPrivateKeyPreference must be used within SessionPrivateKeyProvider',
    );
  }
  return ctx;
}

export { isSessionPrivateKeyStorageEnabled } from '@/utils/sessionPrivateKeyPreference.ts';
