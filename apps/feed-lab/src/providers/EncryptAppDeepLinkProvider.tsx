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
import Button from '@mui/material/Button';
import DialogActions from '@mui/material/DialogActions';
import DialogContent from '@mui/material/DialogContent';
import Typography from '@mui/material/Typography';
import { AppDialog } from '@encrypt/ui/AppDialog';
import { abortPendingBridgeWork } from '@lab/crypto/systemAppSigner.ts';
import {
  ENCRYPT_APP_DEEP_LINK_CANCELLED_ERROR,
  markEncryptDeepLinkBatchCancelled,
  setEncryptAppDeepLinkOpenHandler,
  suppressEncryptDeepLinkAutoOpen,
} from '@lab/lib/encryptAppDeepLinkGate.ts';

type PendingDeepLink = {
  resolve: () => void;
  reject: (error: Error) => void;
};

const EncryptAppDeepLinkContext = createContext<object | null>(null);

export function EncryptAppDeepLinkProvider({
  children,
}: {
  children: ReactNode;
}) {
  const [open, setOpen] = useState(false);
  const [queuedCount, setQueuedCount] = useState(0);
  const activeRef = useRef<PendingDeepLink | null>(null);
  const queueRef = useRef<PendingDeepLink[]>([]);

  const syncQueuedCount = useCallback(() => {
    setQueuedCount(queueRef.current.length);
  }, []);

  const rejectAllPending = useCallback(
    (error: Error, deferClose = false) => {
      const active = activeRef.current;
      const queued = queueRef.current.splice(0);
      activeRef.current = null;
      queueRef.current = [];
      syncQueuedCount();

      const closeDialog = () => setOpen(false);
      if (deferClose) {
        window.setTimeout(closeDialog, 0);
      } else {
        closeDialog();
      }

      active?.reject(error);
      for (const pending of queued) {
        pending.reject(error);
      }
    },
    [syncQueuedCount],
  );

  const showNextPending = useCallback(() => {
    const next = queueRef.current.shift() ?? null;
    activeRef.current = next;
    syncQueuedCount();
    setOpen(next !== null);
  }, [syncQueuedCount]);

  useEffect(() => {
    setEncryptAppDeepLinkOpenHandler((pending) => {
      const entry: PendingDeepLink = {
        resolve: pending.resolve,
        reject: pending.reject,
      };

      if (activeRef.current) {
        queueRef.current.push(entry);
        syncQueuedCount();
        return;
      }

      activeRef.current = entry;
      setOpen(true);
    });

    return () => {
      setEncryptAppDeepLinkOpenHandler(null);
      abortPendingBridgeWork();
      rejectAllPending(new Error(ENCRYPT_APP_DEEP_LINK_CANCELLED_ERROR));
    };
  }, [rejectAllPending, syncQueuedCount]);

  const handleOpen = useCallback(() => {
    const active = activeRef.current;
    if (!active) {
      setOpen(false);
      return;
    }
    activeRef.current = null;
    active.resolve();
    showNextPending();
  }, [showNextPending]);

  const handleCancel = useCallback(
    (event?: React.SyntheticEvent) => {
      event?.preventDefault();
      event?.stopPropagation();
      suppressEncryptDeepLinkAutoOpen();
      markEncryptDeepLinkBatchCancelled();
      abortPendingBridgeWork();
      rejectAllPending(new Error(ENCRYPT_APP_DEEP_LINK_CANCELLED_ERROR), true);
    },
    [rejectAllPending],
  );

  const value = useMemo(() => ({}), []);

  const pendingTotal = queuedCount + (open ? 1 : 0);

  return (
    <EncryptAppDeepLinkContext.Provider value={value}>
      {children}
      <AppDialog
        open={open}
        onClose={(_event, reason) => {
          if (reason === 'backdropClick') {
            return;
          }
          handleCancel();
        }}
        disableRestoreFocus
        title="Continue in Encrypt app"
        maxWidth="xs"
        fullWidth
      >
        <DialogContent>
          <Typography variant="body2" color="text.secondary">
            Your application needs a tap to open the Encrypt app for the next
            signing step. Tap below to continue.
          </Typography>
          {queuedCount > 0 ? (
            <Typography variant="body2" color="text.secondary" sx={{ mt: 1.5 }}>
              {queuedCount} more signing{' '}
              {queuedCount === 1 ? 'step is' : 'steps are'} waiting. Cancel
              dismisses all of them.
            </Typography>
          ) : null}
        </DialogContent>
        <DialogActions sx={{ px: 3, pb: 2 }}>
          <Button
            type="button"
            onPointerDown={(event) => {
              event.preventDefault();
              event.stopPropagation();
            }}
            onClick={handleCancel}
          >
            Cancel{pendingTotal > 1 ? ` all (${pendingTotal})` : ''}
          </Button>
          <Button
            type="button"
            variant="contained"
            onPointerDown={(event) => {
              event.preventDefault();
              event.stopPropagation();
            }}
            onClick={(event) => {
              event.stopPropagation();
              handleOpen();
            }}
            autoFocus
          >
            Use Encrypt app
          </Button>
        </DialogActions>
      </AppDialog>
    </EncryptAppDeepLinkContext.Provider>
  );
}

export function useEncryptAppDeepLink(): object {
  const context = useContext(EncryptAppDeepLinkContext);
  if (!context) {
    throw new Error(
      'useEncryptAppDeepLink must be used within EncryptAppDeepLinkProvider',
    );
  }
  return context;
}
