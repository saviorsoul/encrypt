import { useEffect, useRef } from 'react';
import { CopiedToClipboardSnackbar } from '@/components/CopiedToClipboardSnackbar.tsx';
import { useElectronEncryptPlaintextMessage } from '@/hooks/useElectronEncryptPlaintextMessage.ts';

/** Tray IPC encrypt ingress (OS menu recipient is chosen before IPC). */
export function ElectronDesktopEncryptHandler() {
  const {
    closeSnackbar,
    handleTrayEncryptPayload,
    snackbar,
  } = useElectronEncryptPlaintextMessage();

  const handleTrayEncryptRef = useRef(handleTrayEncryptPayload);

  useEffect(() => {
    handleTrayEncryptRef.current = handleTrayEncryptPayload;
  }, [handleTrayEncryptPayload]);

  useEffect(() => {
    const unsubscribeTray = window.electron?.onTrayEncryptCopiedMessage(
      (payload) => {
        void handleTrayEncryptRef.current(payload);
      },
    );

    return () => {
      unsubscribeTray?.();
    };
  }, []);

  return (
    <CopiedToClipboardSnackbar
      open={snackbar.open}
      severity={snackbar.severity}
      onClose={closeSnackbar}
      snackbarKey={snackbar.key}
      successMessage={snackbar.message}
      errorMessage={snackbar.message}
    />
  );
}
