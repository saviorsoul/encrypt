import React, {
  createContext,
  useContext,
  useEffect,
  useMemo,
  useState,
  type ReactNode,
} from 'react';
import Alert from '@mui/material/Alert';
import Snackbar from '@mui/material/Snackbar';
import {
  isFreshLogin,
  STORAGE_AT_RISK_STORAGE_KEY,
} from '@/components/providers/AuthProvider.tsx';
import { useAuth } from '@/hooks/useAuth.ts';
import { requestPersistentStorage } from '@/utils/requestPersistentStorage.ts';
import {
  STORAGE_PERSISTENCE_WARNING_MESSAGE,
  STORAGE_PERSISTENCE_WARNING_SNACKBAR_MS,
} from '@/utils/storagePersistenceWarning.ts';

export type StoragePersistenceContextValue = {
  storagePersistenceAtRisk: boolean;
};

export const StoragePersistenceContext =
  createContext<StoragePersistenceContextValue | null>(null);

function readStorageAtRiskFlag(): boolean {
  try {
    return sessionStorage.getItem(STORAGE_AT_RISK_STORAGE_KEY) === '1';
  } catch {
    return false;
  }
}

function writeStorageAtRiskFlag(atRisk: boolean): void {
  try {
    if (atRisk) {
      sessionStorage.setItem(STORAGE_AT_RISK_STORAGE_KEY, '1');
    } else {
      sessionStorage.removeItem(STORAGE_AT_RISK_STORAGE_KEY);
    }
  } catch {
    /* ignore quota / privacy mode */
  }
}

function StoragePersistenceState({ children }: { children: ReactNode }) {
  const { user } = useAuth();
  const [storagePersistenceAtRisk, setStoragePersistenceAtRisk] = useState(() =>
    readStorageAtRiskFlag(),
  );
  const [warningSnackbarOpen, setWarningSnackbarOpen] = useState(false);

  const applyPersistenceResult = (
    granted: boolean,
    { showSnackbarOnDenial = false }: { showSnackbarOnDenial?: boolean } = {},
  ) => {
    writeStorageAtRiskFlag(!granted);
    setStoragePersistenceAtRisk(!granted);
    if (!granted && showSnackbarOnDenial) {
      setWarningSnackbarOpen(true);
    }
  };

  useEffect(() => {
    if (!user || !isFreshLogin()) {
      return;
    }

    let cancelled = false;

    void requestPersistentStorage().then((granted) => {
      if (cancelled) {
        return;
      }

      applyPersistenceResult(granted, { showSnackbarOnDenial: true });
    });

    return () => {
      cancelled = true;
    };
  }, [user]);

  useEffect(() => {
    if (!user || !storagePersistenceAtRisk) {
      return;
    }

    let cancelled = false;

    const recheckPersistence = () => {
      void requestPersistentStorage().then((granted) => {
        if (cancelled || !granted) {
          return;
        }

        applyPersistenceResult(true);
      });
    };

    recheckPersistence();

    const onVisibilityChange = () => {
      if (document.visibilityState === 'visible') {
        recheckPersistence();
      }
    };

    document.addEventListener('visibilitychange', onVisibilityChange);
    return () => {
      cancelled = true;
      document.removeEventListener('visibilitychange', onVisibilityChange);
    };
  }, [user, storagePersistenceAtRisk]);

  const value = useMemo(
    () => ({ storagePersistenceAtRisk }),
    [storagePersistenceAtRisk],
  );

  return (
    <StoragePersistenceContext value={value}>
      {children}
      <Snackbar
        open={warningSnackbarOpen}
        autoHideDuration={STORAGE_PERSISTENCE_WARNING_SNACKBAR_MS}
        onClose={() => setWarningSnackbarOpen(false)}
        anchorOrigin={{ vertical: 'top', horizontal: 'center' }}
      >
        <Alert
          severity="warning"
          variant="filled"
          onClose={() => setWarningSnackbarOpen(false)}
          sx={{ width: '100%' }}
        >
          {STORAGE_PERSISTENCE_WARNING_MESSAGE}
        </Alert>
      </Snackbar>
    </StoragePersistenceContext>
  );
}

export function StoragePersistenceProvider({
  children,
}: {
  children: ReactNode;
}) {
  const { user } = useAuth();

  return (
    <StoragePersistenceState key={user?.username ?? 'logged-out'}>
      {children}
    </StoragePersistenceState>
  );
}

export function useStoragePersistence(): StoragePersistenceContextValue {
  const ctx = useContext(StoragePersistenceContext);
  if (!ctx) {
    throw new Error(
      'useStoragePersistence must be used within StoragePersistenceProvider',
    );
  }
  return ctx;
}
