import type { AlertProps } from '@mui/material/Alert';
import { useCallback, useState } from 'react';
import {
  COPIED_TO_CLIPBOARD_MESSAGE,
  COPY_TO_CLIPBOARD_FAILED_MESSAGE,
} from '@/components/CopiedToClipboardSnackbar.tsx';
import {
  encryptCopiedMessageForRecipient,
  saveTrayEncryptToOneToOneThread,
} from '@/crypto/trayEncryptCopiedMessage.ts';
import { ecPublicJwkThumbprintSha256 } from '@/crypto/jwkThumbprint.ts';
import { assertUploadedPrivateKeyMatchesKeyId } from '@/crypto/privateKeyMaterial.ts';
import {
  isPrivateKeyFileSelectionCancelled,
  withUploadedPrivateKey,
} from '@/crypto/privateKeyFile.ts';
import { getCachedPrivateKeyMaterial } from '@/crypto/sessionPrivateKeyStorage.ts';
import { useAuth } from '@/hooks/useAuth.ts';
import { useKeysContext } from '@/hooks/useKeysContext.ts';
import { dispatchTrayOneToOneMessageSaved } from '@/utils/trayOneToOneMessageSavedEvent.ts';
import type { TrayEncryptCopiedMessagePayload } from '@/vite-env.d.ts';
import { copyTextToClipboard } from '@/utils/copyToClipboard.ts';
import { errorMessage } from '@/utils/errorMessage.ts';

type EncryptSnackbarState = {
  open: boolean;
  key: number;
  severity: NonNullable<AlertProps['severity']>;
  message: string;
};

const CLOSED_SNACKBAR: EncryptSnackbarState = {
  open: false,
  key: 0,
  severity: 'success',
  message: '',
};

export const LOG_IN_FIRST_TO_ENCRYPT_MESSAGE =
  'Log in first to encrypt a message.';

export function useElectronEncryptPlaintextMessage() {
  const keys = useKeysContext();
  const { user } = useAuth();
  const [snackbar, setSnackbar] =
    useState<EncryptSnackbarState>(CLOSED_SNACKBAR);
  const [encrypting, setEncrypting] = useState(false);

  const closeSnackbar = useCallback(() => {
    setSnackbar((prev) => ({ ...prev, open: false }));
  }, []);

  const showSnackbar = useCallback(
    (severity: NonNullable<AlertProps['severity']>, message: string) => {
      setSnackbar((prev) => ({
        open: true,
        key: prev.key + 1,
        severity,
        message,
      }));
    },
    [],
  );

  const revealWindow = useCallback(async () => {
    await window.electron?.showMainWindow();
  }, []);

  const encryptPlaintextForRecipient = useCallback(
    async (
      username: string,
      plaintext: string,
      options?: {
        failureMessage?: string;
        onSuccess?: () => void;
        onFailure?: (message: string) => void;
      },
    ) => {
      if (!user) {
        await revealWindow();
        const message = LOG_IN_FIRST_TO_ENCRYPT_MESSAGE;
        showSnackbar('info', message);
        options?.onFailure?.(message);
        return false;
      }

      if (!keys?.publicKey || !keys?.publicKeyJwk) {
        await revealWindow();
        const message = 'Keys are not ready yet.';
        showSnackbar('error', message);
        options?.onFailure?.(message);
        return false;
      }

      const runInBackground = Boolean(getCachedPrivateKeyMaterial());
      if (!runInBackground) {
        await revealWindow();
      }

      setEncrypting(true);
      try {
        await withUploadedPrivateKey(async (material) => {
          assertUploadedPrivateKeyMatchesKeyId(
            material,
            await ecPublicJwkThumbprintSha256(keys.publicKeyJwk!),
            'Uploaded private key does not match your stored public key.',
          );

          const result = await encryptCopiedMessageForRecipient(
            plaintext,
            username,
            material,
            keys.publicKey!,
          );
          const savedItem = await saveTrayEncryptToOneToOneThread(result);
          dispatchTrayOneToOneMessageSaved({
            item: savedItem,
            senderKeyId: result.senderKeyId,
            recipientKeyId: result.recipientKeyId,
            recipientUsername: username,
            plaintext: result.plaintext,
          });
          try {
            await copyTextToClipboard(result.payload);
            await window.electron?.flashTraySuccess();
            options?.onSuccess?.();
            if (!runInBackground) {
              showSnackbar('success', COPIED_TO_CLIPBOARD_MESSAGE);
            }
          } catch (e) {
            console.error(e);
            await revealWindow();
            showSnackbar('error', COPY_TO_CLIPBOARD_FAILED_MESSAGE);
            options?.onFailure?.(COPY_TO_CLIPBOARD_FAILED_MESSAGE);
          }
        });
        return true;
      } catch (caught) {
        if (isPrivateKeyFileSelectionCancelled(caught)) {
          return false;
        }
        await revealWindow();
        const message = errorMessage(
          caught,
          options?.failureMessage ?? 'Failed to encrypt message.',
        );
        showSnackbar('error', message);
        options?.onFailure?.(message);
        return false;
      } finally {
        setEncrypting(false);
      }
    },
    [keys, revealWindow, showSnackbar, user],
  );

  const handleTrayEncryptPayload = useCallback(
    async (payload: TrayEncryptCopiedMessagePayload) => {
      if (payload.error) {
        await revealWindow();
        showSnackbar('error', payload.error);
        return;
      }

      const { username, plaintext } = payload;
      if (!plaintext) {
        return;
      }

      await encryptPlaintextForRecipient(username, plaintext, {
        failureMessage: 'Failed to encrypt copied message.',
      });
    },
    [encryptPlaintextForRecipient, revealWindow, showSnackbar],
  );

  return {
    closeSnackbar,
    encrypting,
    encryptPlaintextForRecipient,
    handleTrayEncryptPayload,
    revealWindow,
    showSnackbar,
    snackbar,
  };
}
