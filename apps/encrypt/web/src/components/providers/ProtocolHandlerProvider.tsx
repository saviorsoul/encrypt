import React, {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
  type ReactNode,
} from 'react';
import Alert from '@mui/material/Alert';
import Button from '@mui/material/Button';
import Snackbar from '@mui/material/Snackbar';
import {
  PROTOCOL_HANDLER_RESTORED_MESSAGE,
  PROTOCOL_HANDLER_RESTORE_FAILED_MESSAGE,
  PROTOCOL_HANDLER_WARNING_MESSAGE,
} from '@/utils/protocolHandlerWarning.ts';
import type { ProtocolHandlerStatus } from '@/vite-env.d.ts';

export type ProtocolHandlerContextValue = {
  protocolHandlerAtRisk: boolean;
  restoring: boolean;
  restoreDefaultHandler: () => Promise<void>;
  recheckHandlerStatus: () => Promise<void>;
};

export const ProtocolHandlerContext =
  createContext<ProtocolHandlerContextValue | null>(null);

function isHandlerAtRisk(
  status: ProtocolHandlerStatus | null | undefined,
): boolean {
  return Boolean(status?.applicable && !status.isDefault);
}

const noopProtocolHandlerContext: ProtocolHandlerContextValue = {
  protocolHandlerAtRisk: false,
  restoring: false,
  restoreDefaultHandler: async () => {},
  recheckHandlerStatus: async () => {},
};

function ProtocolHandlerState({ children }: { children: ReactNode }) {
  const [protocolHandlerAtRisk, setProtocolHandlerAtRisk] = useState(false);
  const [snackbarOpen, setSnackbarOpen] = useState(false);
  const [snackbarMessage, setSnackbarMessage] = useState(
    PROTOCOL_HANDLER_WARNING_MESSAGE,
  );
  const [snackbarSeverity, setSnackbarSeverity] = useState<
    'success' | 'warning'
  >('warning');
  const [showRestoreAction, setShowRestoreAction] = useState(true);
  const [restoring, setRestoring] = useState(false);

  const openWarningSnackbar = useCallback(() => {
    setSnackbarSeverity('warning');
    setSnackbarMessage(PROTOCOL_HANDLER_WARNING_MESSAGE);
    setShowRestoreAction(true);
    setSnackbarOpen(true);
  }, []);

  const recheckHandlerStatus = useCallback(async () => {
    const status = await window.electron?.getProtocolHandlerStatus?.();
    const atRisk = isHandlerAtRisk(status);
    setProtocolHandlerAtRisk(atRisk);
    if (atRisk) {
      openWarningSnackbar();
    }
  }, [openWarningSnackbar]);

  const restoreDefaultHandler = useCallback(async () => {
    setRestoring(true);
    try {
      const result = await window.electron?.restoreDefaultProtocolHandler?.();
      const atRisk = isHandlerAtRisk(result);
      setProtocolHandlerAtRisk(atRisk);

      if (result?.isDefault) {
        setSnackbarSeverity('success');
        setSnackbarMessage(PROTOCOL_HANDLER_RESTORED_MESSAGE);
        setShowRestoreAction(false);
        setSnackbarOpen(true);
        return;
      }

      setSnackbarSeverity('warning');
      setSnackbarMessage(PROTOCOL_HANDLER_RESTORE_FAILED_MESSAGE);
      setShowRestoreAction(true);
      setSnackbarOpen(true);
    } finally {
      setRestoring(false);
    }
  }, []);

  useEffect(() => {
    if (!import.meta.env.VITE_ELECTRON) {
      return;
    }

    let cancelled = false;

    void window.electron?.getProtocolHandlerStatus?.().then((status) => {
      if (cancelled) {
        return;
      }

      const atRisk = isHandlerAtRisk(status);
      setProtocolHandlerAtRisk(atRisk);
      if (atRisk) {
        openWarningSnackbar();
      }
    });

    return () => {
      cancelled = true;
    };
  }, [openWarningSnackbar]);

  useEffect(() => {
    if (!import.meta.env.VITE_ELECTRON || !protocolHandlerAtRisk) {
      return;
    }

    const onVisibilityChange = () => {
      if (document.visibilityState === 'visible') {
        void recheckHandlerStatus();
      }
    };

    document.addEventListener('visibilitychange', onVisibilityChange);
    return () => {
      document.removeEventListener('visibilitychange', onVisibilityChange);
    };
  }, [protocolHandlerAtRisk, recheckHandlerStatus]);

  const value = useMemo(
    () => ({
      protocolHandlerAtRisk,
      restoring,
      restoreDefaultHandler,
      recheckHandlerStatus,
    }),
    [
      protocolHandlerAtRisk,
      restoring,
      restoreDefaultHandler,
      recheckHandlerStatus,
    ],
  );

  const autoHideDuration = snackbarSeverity === 'success' ? 5000 : null;

  return (
    <ProtocolHandlerContext value={value}>
      {children}
      <Snackbar
        open={snackbarOpen}
        autoHideDuration={autoHideDuration}
        onClose={() => setSnackbarOpen(false)}
        anchorOrigin={{ vertical: 'top', horizontal: 'center' }}
      >
        <Alert
          severity={snackbarSeverity}
          variant="filled"
          onClose={() => setSnackbarOpen(false)}
          action={
            showRestoreAction ? (
              <Button
                variant="outlined"
                color="inherit"
                size="small"
                disabled={restoring}
                onClick={() => {
                  void restoreDefaultHandler();
                }}
              >
                Restore
              </Button>
            ) : undefined
          }
          sx={{ width: '100%' }}
        >
          {snackbarMessage}
        </Alert>
      </Snackbar>
    </ProtocolHandlerContext>
  );
}

export function useProtocolHandler(): ProtocolHandlerContextValue {
  const ctx = useContext(ProtocolHandlerContext);
  if (!ctx) {
    throw new Error(
      'useProtocolHandler must be used within ProtocolHandlerProvider',
    );
  }
  return ctx;
}

export function ProtocolHandlerProvider({ children }: { children: ReactNode }) {
  if (!import.meta.env.VITE_ELECTRON) {
    return (
      <ProtocolHandlerContext value={noopProtocolHandlerContext}>
        {children}
      </ProtocolHandlerContext>
    );
  }

  return <ProtocolHandlerState>{children}</ProtocolHandlerState>;
}
