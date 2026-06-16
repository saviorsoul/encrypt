import { useCallback, useEffect, useRef, useState } from 'react';
import {
  COPIED_TO_CLIPBOARD_MESSAGE,
  COPY_TO_CLIPBOARD_FAILED_MESSAGE,
  CopiedToClipboardSnackbar,
} from '@/components/CopiedToClipboardSnackbar.tsx';
import {
  encryptCopiedMessageForRecipient,
  saveTrayEncryptToOneToOneThread,
} from '@/crypto/trayEncryptCopiedMessage.ts';
import { dispatchTrayOneToOneMessageSaved } from '@/utils/trayOneToOneMessageSavedEvent.ts';
import type { TrayEncryptCopiedMessagePayload } from '@/vite-env.d.ts';
import { copyTextToClipboard } from '@/utils/copyToClipboard.ts';
import { errorMessage } from '@/utils/errorMessage.ts';

type TraySnackbarState = {
  open: boolean;
  key: number;
  severity: 'success' | 'error';
  message: string;
};

const CLOSED_SNACKBAR: TraySnackbarState = {
  open: false,
  key: 0,
  severity: 'success',
  message: '',
};

export function ElectronTrayEncryptHandler() {
  const [snackbar, setSnackbar] = useState<TraySnackbarState>(CLOSED_SNACKBAR);

  const closeSnackbar = useCallback(() => {
    setSnackbar((prev) => ({ ...prev, open: false }));
  }, []);

  const showSnackbar = useCallback(
    (severity: 'success' | 'error', message: string) => {
      setSnackbar((prev) => ({
        open: true,
        key: prev.key + 1,
        severity,
        message,
      }));
    },
    [],
  );

  const handleTrayEncrypt = useCallback(
    async (payload: TrayEncryptCopiedMessagePayload) => {
      if (payload.error) {
        showSnackbar('error', payload.error);
        return;
      }

      try {
        const result = await encryptCopiedMessageForRecipient(
          payload.plaintext,
          payload.username,
          payload.privateKeyText,
        );
        const savedItem = await saveTrayEncryptToOneToOneThread(result);
        dispatchTrayOneToOneMessageSaved({
          item: savedItem,
          senderKeyId: result.senderKeyId,
          recipientKeyId: result.recipientKeyId,
          recipientUsername: payload.username,
          plaintext: result.plaintext,
        });
        try {
          await copyTextToClipboard(result.payload);
          showSnackbar('success', COPIED_TO_CLIPBOARD_MESSAGE);
        } catch (e) {
          console.error(e);
          showSnackbar('error', COPY_TO_CLIPBOARD_FAILED_MESSAGE);
        }
      } catch (caught) {
        showSnackbar(
          'error',
          errorMessage(caught, 'Failed to encrypt copied message.'),
        );
      }
    },
    [showSnackbar],
  );

  const handleTrayEncryptRef = useRef(handleTrayEncrypt);

  useEffect(() => {
    handleTrayEncryptRef.current = handleTrayEncrypt;
  }, [handleTrayEncrypt]);

  useEffect(() => {
    return window.electron?.onTrayEncryptCopiedMessage((payload) => {
      void handleTrayEncryptRef.current(payload);
    });
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
