import { useCallback, useEffect, useRef, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  COPIED_TO_CLIPBOARD_MESSAGE,
  CopiedToClipboardSnackbar,
} from '@/components/CopiedToClipboardSnackbar.tsx';
import { ElectronDeepLinkConfirmDialog } from '@/components/providers/ElectronDeepLinkConfirmDialog.tsx';
import { RecipientPickerDialogs } from '@/components/one-to-one/RecipientPickerDialogs.tsx';
import { EncryptMessageDialog } from '@/components/one-to-one/EncryptMessageDialog.tsx';
import { useExternalFileContext } from '@/components/providers/ExternalFileProvider.tsx';
import { formatEcPublicKeyText } from '@/crypto/ecPublicKey.ts';
import { useAuth } from '@/hooks/useAuth.ts';
import {
  LOG_IN_FIRST_TO_ENCRYPT_MESSAGE,
  useElectronEncryptPlaintextMessage,
} from '@/hooks/useElectronEncryptPlaintextMessage.ts';
import { useKeysContext } from '@/hooks/useKeysContext.ts';
import { copyTextToClipboard } from '@/utils/copyToClipboard.ts';
import {
  readPendingEncryptPickPlaintext,
  writePendingEncryptPickPlaintext,
} from '@/utils/pendingEncryptPickPlaintext.ts';
import { saveLastOneToOneRecipientUsername } from '@/utils/lastOneToOneRecipient.ts';
import {
  dispatchOneToOneRecipientSelected,
  writePendingOneToOneRecipientSelect,
} from '@/utils/oneToOneRecipientSelect.ts';
import { validateBaseJsonText } from '@/utils/validateBaseJsonText.ts';
import type { DeepLinkAction, DeepLinkErrorPayload } from '@/vite-env.d.ts';
import {
  dispatchFeedLabBridgeAction,
  isFeedLabBridgeDeepLinkAction,
} from '@/utils/feedLabBridgeDispatch.ts';

const DEEP_LINK_DECRYPT_SOURCE_NAME = 'Browser extension';

/**
 * Deep-link ingress: every encrypt:// action is shown to the user for
 * confirmation before any crypto, import, or clipboard side effect runs.
 */
export function ElectronDeepLinkHandler() {
  const navigate = useNavigate();
  const { user } = useAuth();
  const keys = useKeysContext();
  const { importExternalText } = useExternalFileContext();
  const {
    closeSnackbar,
    encrypting,
    encryptPlaintextForRecipient,
    revealWindow,
    showSnackbar,
    snackbar,
  } = useElectronEncryptPlaintextMessage();

  const [pendingAction, setPendingAction] = useState<DeepLinkAction | null>(
    null,
  );
  const [pickerOpen, setPickerOpen] = useState(false);
  const [encryptDialogOpen, setEncryptDialogOpen] = useState(false);
  const [selectedRecipient, setSelectedRecipient] = useState('');
  const [plaintext, setPlaintext] = useState('');
  const [encryptError, setEncryptError] = useState<string | null>(null);
  const openingPickerRef = useRef(false);

  const closeEncryptDialog = useCallback(() => {
    if (encrypting) {
      return;
    }
    setEncryptDialogOpen(false);
    setSelectedRecipient('');
    setEncryptError(null);
    setPlaintext('');
  }, [encrypting]);

  const closePicker = useCallback(() => {
    setPickerOpen(false);
  }, []);

  const dismissPicker = useCallback(() => {
    setPickerOpen(false);
    setPlaintext('');
  }, []);

  const openPicker = useCallback(async (text: string) => {
    if (openingPickerRef.current) {
      return;
    }

    openingPickerRef.current = true;
    try {
      setPlaintext(text);
      setPickerOpen(true);
      writePendingEncryptPickPlaintext(null);
    } catch (caught) {
      console.error('Failed to open encrypt recipient picker.', caught);
      writePendingEncryptPickPlaintext(text);
    } finally {
      openingPickerRef.current = false;
    }
  }, []);

  const openPickerRef = useRef(openPicker);

  useEffect(() => {
    openPickerRef.current = openPicker;
  }, [openPicker]);

  const queuePickAfterLogin = useCallback(
    (text: string) => {
      writePendingEncryptPickPlaintext(text);
      showSnackbar('info', LOG_IN_FIRST_TO_ENCRYPT_MESSAGE);
      navigate('/login', { replace: true });
    },
    [navigate, showSnackbar],
  );

  const tryOpenPendingPick = useCallback(() => {
    if (!user) {
      return;
    }

    const pending = readPendingEncryptPickPlaintext();
    if (!pending) {
      return;
    }

    void openPickerRef.current(pending);
  }, [user]);

  const executeConfirmedAction = useCallback(
    async (action: DeepLinkAction) => {
      await revealWindow();

      switch (action.type) {
        case 'copy-public-key': {
          if (!user) {
            showSnackbar(
              'error',
              'Sign in to Encrypt to copy your public key.',
            );
            return;
          }
          if (!keys.publicKeyJwk || keys.loading) {
            showSnackbar('error', 'Public key is not ready yet.');
            return;
          }
          try {
            await copyTextToClipboard(formatEcPublicKeyText(keys.publicKeyJwk));
            await window.electron?.flashTraySuccess();
            showSnackbar('success', COPIED_TO_CLIPBOARD_MESSAGE);
          } catch (caught) {
            console.error(caught);
            showSnackbar('error', 'Failed to copy public key.');
          }
          return;
        }
        case 'encrypt': {
          if (!user) {
            queuePickAfterLogin(action.text);
            return;
          }

          await openPicker(action.text);
          return;
        }
        case 'decrypt': {
          const validated = validateBaseJsonText(action.text);
          if (validated.ok === false) {
            importExternalText({
              sourceName: DEEP_LINK_DECRYPT_SOURCE_NAME,
              error: validated.error,
            });
            return;
          }

          importExternalText({
            sourceName: DEEP_LINK_DECRYPT_SOURCE_NAME,
            text: validated.text,
          });
          return;
        }
      }
    },
    [
      importExternalText,
      keys.loading,
      keys.publicKeyJwk,
      openPicker,
      queuePickAfterLogin,
      revealWindow,
      showSnackbar,
      user,
    ],
  );

  const handleRecipientChosen = useCallback(
    (username: string) => {
      if (!user) {
        queuePickAfterLogin(plaintext);
        return;
      }

      if (user.username) {
        saveLastOneToOneRecipientUsername(user.username, username);
      }

      writePendingOneToOneRecipientSelect(username);
      dispatchOneToOneRecipientSelected(username);
      navigate('/', { replace: true });

      setSelectedRecipient(username);
      setEncryptError(null);
      setEncryptDialogOpen(true);
    },
    [navigate, plaintext, queuePickAfterLogin, user],
  );

  const handleEncryptFromDialog = useCallback(
    (message: string) => {
      if (!user || !selectedRecipient) {
        return;
      }

      void encryptPlaintextForRecipient(selectedRecipient, message, {
        failureMessage: 'Failed to encrypt message from external request.',
        onSuccess: () => {
          setEncryptDialogOpen(false);
          setSelectedRecipient('');
          setEncryptError(null);
          setPlaintext('');
        },
        onFailure: (message) => {
          setEncryptError(message);
        },
      });
    },
    [encryptPlaintextForRecipient, selectedRecipient, user],
  );

  const queueActionForConfirm = useCallback((action: DeepLinkAction) => {
    if (isFeedLabBridgeDeepLinkAction(action)) {
      dispatchFeedLabBridgeAction(action);
      return;
    }
    setPendingAction(action);
  }, []);

  const handleConfirm = useCallback(() => {
    if (!pendingAction) {
      return;
    }

    const action = pendingAction;
    setPendingAction(null);
    void executeConfirmedAction(action);
  }, [executeConfirmedAction, pendingAction]);

  const handleCancel = useCallback(() => {
    setPendingAction(null);
  }, []);

  const queueActionForConfirmRef = useRef(queueActionForConfirm);
  const showSnackbarRef = useRef(showSnackbar);

  useEffect(() => {
    queueActionForConfirmRef.current = queueActionForConfirm;
  }, [queueActionForConfirm]);

  useEffect(() => {
    showSnackbarRef.current = showSnackbar;
  }, [showSnackbar]);

  useEffect(() => {
    tryOpenPendingPick();
  }, [tryOpenPendingPick]);

  useEffect(() => {
    const unsubscribeAction = window.electron?.onDeepLinkActionRequest(
      (action) => {
        if (isFeedLabBridgeDeepLinkAction(action)) {
          queueActionForConfirmRef.current(action);
          return;
        }

        void revealWindow();
        queueActionForConfirmRef.current(action);
      },
    );
    const unsubscribeError = window.electron?.onDeepLinkError(
      (payload: DeepLinkErrorPayload) => {
        void window.electron?.showMainWindow();
        showSnackbarRef.current('error', payload.message);
      },
    );

    void window.electron?.consumePendingDeepLinkAction?.().then((action) => {
      if (action && !isFeedLabBridgeDeepLinkAction(action)) {
        queueActionForConfirmRef.current(action);
      }
    });

    return () => {
      unsubscribeAction?.();
      unsubscribeError?.();
    };
  }, [revealWindow]);

  return (
    <>
      <ElectronDeepLinkConfirmDialog
        action={pendingAction}
        onCancel={handleCancel}
        onConfirm={handleConfirm}
      />
      <RecipientPickerDialogs
        open={pickerOpen}
        onClose={closePicker}
        onDismiss={dismissPicker}
        onRecipientChosen={handleRecipientChosen}
      />
      <EncryptMessageDialog
        open={encryptDialogOpen}
        roleLabel={user?.username ?? 'Sender'}
        encrypting={encrypting}
        error={encryptError}
        initialMessage={plaintext}
        onClose={closeEncryptDialog}
        onMessageChange={() => setEncryptError(null)}
        onEncrypt={handleEncryptFromDialog}
      />
      <CopiedToClipboardSnackbar
        open={snackbar.open}
        severity={snackbar.severity}
        onClose={closeSnackbar}
        snackbarKey={snackbar.key}
        successMessage={snackbar.message}
        errorMessage={snackbar.message}
      />
    </>
  );
}
