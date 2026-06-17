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
import { ecPublicJwkThumbprintSha256 } from '@/crypto/jwkThumbprint.ts';
import { assertUploadedPrivateKeyMatchesKeyId } from '@/crypto/privateKeyMaterial.ts';
import {
  isPrivateKeyFileSelectionCancelled,
  pickPrivateKeyJwkInElectronNativeDialog,
  withUploadedPrivateKey,
} from '@/crypto/privateKeyFile.ts';
import { getCachedPrivateKeyMaterial } from '@/crypto/sessionPrivateKeyStorage.ts';
import { useKeysContext } from '@/hooks/useKeysContext.ts';
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
  const keys = useKeysContext();
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
      const revealWindow = async () => {
        await window.electron?.showMainWindow();
      };

      if (payload.error) {
        await revealWindow();
        showSnackbar('error', payload.error);
        return;
      }

      if (!keys?.publicKey || !keys?.publicKeyJwk) {
        await revealWindow();
        showSnackbar('error', 'Keys are not ready yet.');
        return;
      }

      const runInBackground = Boolean(getCachedPrivateKeyMaterial());

      if (!runInBackground) {
        await revealWindow();
      }

      try {
        await withUploadedPrivateKey(
          async (material) => {
            assertUploadedPrivateKeyMatchesKeyId(
              material,
              await ecPublicJwkThumbprintSha256(keys.publicKeyJwk!),
              'Uploaded private key does not match your stored public key.',
            );

            const result = await encryptCopiedMessageForRecipient(
              payload.plaintext,
              payload.username,
              material,
              keys.publicKey!,
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
              await window.electron?.flashTraySuccess();
              if (!runInBackground) {
                showSnackbar('success', COPIED_TO_CLIPBOARD_MESSAGE);
              }
            } catch (e) {
              console.error(e);
              await revealWindow();
              showSnackbar('error', COPY_TO_CLIPBOARD_FAILED_MESSAGE);
            }
          },
          { pickJwk: pickPrivateKeyJwkInElectronNativeDialog },
        );
      } catch (caught) {
        if (isPrivateKeyFileSelectionCancelled(caught)) {
          return;
        }
        await revealWindow();
        showSnackbar(
          'error',
          errorMessage(caught, 'Failed to encrypt copied message.'),
        );
      }
    },
    [keys, showSnackbar],
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
