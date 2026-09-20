import React, { useCallback, useEffect, useRef, useState } from 'react';
import Box from '@mui/material/Box';
import Chip from '@mui/material/Chip';
import CircularProgress from '@mui/material/CircularProgress';
import Divider from '@mui/material/Divider';
import IconButton from '@mui/material/IconButton';
import Tooltip from '@mui/material/Tooltip';
import Typography from '@mui/material/Typography';
import CloudDownloadOutlinedIcon from '@mui/icons-material/CloudDownloadOutlined';
import SendAndArchiveOutlinedIcon from '@mui/icons-material/SendAndArchiveOutlined';
import { EncryptMessageDialog } from '@/components/one-to-one/EncryptMessageDialog.tsx';
import { RecipientPickerDialogs } from '@/components/one-to-one/RecipientPickerDialogs.tsx';
import { useKeysContext } from '@/hooks/useKeysContext.ts';
import { useAuth } from '@/hooks/useAuth.ts';
import { usePublicKeyJwkInput } from '@/hooks/usePublicKeyJwkInput.ts';
import {
  encryptWithManifest,
  type ManifestRecipientKeys,
} from '@/crypto/manifestEncrypt.ts';
import { assertUploadedPrivateKeyMatchesKeyId } from '@/crypto/privateKeyMaterial.ts';
import { formatEcPublicKeyText } from '@/crypto/ecPublicKey.ts';
import { slimEcPublicJwk } from '@/crypto/jwkThumbprint.ts';
import {
  isPrivateKeyFileSelectionCancelled,
  withUploadedPrivateKey,
} from '@/crypto/privateKeyFile.ts';
import {
  loadStoredPublicKeyMaterial,
  loadStoredPublicKeyMaterialByKeyId,
  saveStoredPublicKey,
} from '@/services/db/storedPublicKeys.ts';
import { recoverPeerPublicJwkFromStoredThread } from '@/crypto/oneToOneMessageParties.ts';
import { errorMessage } from '@/utils/errorMessage.ts';
import { isElectronApp } from '@/utils/isElectronApp.ts';
import {
  loadLastOneToOneRecipientUsername,
  resolveInitialOneToOneRecipientUsername,
  saveLastOneToOneRecipientUsername,
} from '@/utils/lastOneToOneRecipient.ts';
import { useStoredUsernames } from '@/hooks/useStoredUsernames.ts';
import type { OneToOneRecipientSelectRequest } from '@/utils/oneToOneRecipientSelect.ts';
import { CopiedToClipboardSnackbar } from '@/components/CopiedToClipboardSnackbar.tsx';
import { useCopiedToClipboardSnackbar } from '@/hooks/useCopiedToClipboardSnackbar.tsx';
import type {
  OneToOneThreadItem,
  PartyKeyIds,
  ThreadSide,
} from '@/types/oneToOne.ts';
import { OneToOneComposeSidePanel } from '@/components/one-to-one/OneToOneComposeSidePanel.tsx';

export type { OneToOneThreadItem, PartyKeyIds, ThreadSide };

type OneToOneEncryptionProps = {
  thread: OneToOneThreadItem[];
  threadLoading?: boolean;
  peerKeyIdToSelect?: string | null;
  onPeerKeyIdSelected?: () => void;
  recipientSelectRequest?: OneToOneRecipientSelectRequest | null;
  onRecipientSelectHandled?: () => void;
  onPeerNeedsName?: (peer: { keyId: string; publicJwk: JsonWebKey }) => void;
  onEncryptedMessage: (
    item: OneToOneThreadItem,
    side: ThreadSide,
    decryptedText: string,
  ) => Promise<void>;
  onImportMessage: () => void;
  importBusy?: boolean;
  onPartyKeyIdsChange: (keyIds: PartyKeyIds) => void;
  onPeerLabelChange?: (label: string) => void;
  threadActions?: React.ReactNode;
};

export function OneToOneEncryption({
  thread,
  threadLoading = false,
  peerKeyIdToSelect = null,
  onPeerKeyIdSelected,
  recipientSelectRequest = null,
  onRecipientSelectHandled,
  onPeerNeedsName,
  onEncryptedMessage,
  onImportMessage,
  importBusy = false,
  onPartyKeyIdsChange,
  onPeerLabelChange,
  threadActions,
}: OneToOneEncryptionProps) {
  const { user } = useAuth();
  const keys = useKeysContext();
  const { copyAndNotify, snackbarProps } = useCopiedToClipboardSnackbar();

  const senderTitle = user?.username ?? 'Sender';

  const [senderJwkText, setSenderJwkText] = useState('');
  const [recipientJwkText, setRecipientJwkText] = useState('');
  const [senderJwkPrefilled, setSenderJwkPrefilled] = useState(false);
  const [senderEncryptError, setSenderEncryptError] = useState<string | null>(
    null,
  );
  const [recipientPanelError, setRecipientPanelError] = useState<string | null>(
    null,
  );
  const [senderEncryptBusy, setSenderEncryptBusy] = useState(false);
  const [encryptDialogOpen, setEncryptDialogOpen] = useState(false);

  const senderJwkTextForInput = isElectronApp()
    ? keys?.publicKeyJwk
      ? formatEcPublicKeyText(keys.publicKeyJwk)
      : ''
    : senderJwkText;

  const senderKeys = usePublicKeyJwkInput(senderJwkTextForInput);
  const recipientKeys = usePublicKeyJwkInput(recipientJwkText);
  const {
    usernames: storedUsernames,
    loading: storedUsersLoading,
    error: storedUsersError,
  } = useStoredUsernames();

  const [selectedStoredUsername, setSelectedStoredUsername] = useState<
    string | null
  >(() => resolveInitialOneToOneRecipientUsername(user?.username));
  const recipientTitle = selectedStoredUsername ?? 'Recipient';
  const [storedUserLoading, setStoredUserLoading] = useState(false);
  const [recipientDialogOpen, setRecipientDialogOpen] = useState(false);
  const [recipientPickerBusy, setRecipientPickerBusy] = useState(false);
  const lastRecipientRestoredForUserRef = useRef<string | null>(null);

  const bothKeysValid = senderKeys.isValid && recipientKeys.isValid;
  const publicKeySectionCollapsed = thread.length > 0 || threadLoading;
  const importActionEnabled = !importBusy;
  const encryptActionEnabled =
    senderKeys.isValid &&
    !senderKeys.importing &&
    !senderEncryptBusy &&
    bothKeysValid;

  if (!isElectronApp() && keys?.publicKeyJwk && !senderJwkPrefilled) {
    setSenderJwkText(formatEcPublicKeyText(keys.publicKeyJwk));
    setSenderJwkPrefilled(true);
  }

  useEffect(() => {
    onPartyKeyIdsChange({
      senderKeyId: senderKeys.keyId,
      recipientKeyId: recipientKeys.keyId,
    });
  }, [senderKeys.keyId, recipientKeys.keyId, onPartyKeyIdsChange]);

  useEffect(() => {
    const loggedInUsername = user?.username;
    if (!loggedInUsername || !selectedStoredUsername) {
      return;
    }
    saveLastOneToOneRecipientUsername(loggedInUsername, selectedStoredUsername);
  }, [user?.username, selectedStoredUsername]);

  useEffect(() => {
    if (!peerKeyIdToSelect) {
      return;
    }

    let cancelled = false;

    void (async () => {
      setRecipientPanelError(null);
      setStoredUserLoading(true);

      try {
        const material =
          await loadStoredPublicKeyMaterialByKeyId(peerKeyIdToSelect);
        if (cancelled) {
          return;
        }

        let publicJwk = material?.publicJwk ?? null;
        if (!publicJwk && senderKeys.keyId) {
          publicJwk = await recoverPeerPublicJwkFromStoredThread(
            senderKeys.keyId,
            peerKeyIdToSelect,
          );
        }

        if (!publicJwk) {
          throw new Error('No public key found for the message recipient.');
        }

        if (!material?.username) {
          onPeerNeedsName?.({ keyId: peerKeyIdToSelect, publicJwk });
          onPeerKeyIdSelected?.();
          return;
        }

        const username = material.username;
        setSelectedStoredUsername(username);
        onPeerLabelChange?.(username);
        setRecipientJwkText(formatEcPublicKeyText(material.publicJwk));
        onPeerKeyIdSelected?.();
      } catch (e) {
        if (!cancelled) {
          setRecipientPanelError(
            errorMessage(e, 'Failed to load recipient public key.'),
          );
        }
      } finally {
        if (!cancelled) {
          setStoredUserLoading(false);
        }
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [
    peerKeyIdToSelect,
    onPeerKeyIdSelected,
    onPeerNeedsName,
    onPeerLabelChange,
    senderKeys.keyId,
  ]);

  const handleSelectStoredUser = useCallback(
    async (username: string | null) => {
      setSelectedStoredUsername(username);
      setRecipientPanelError(null);
      onPeerLabelChange?.(username ?? 'Recipient');

      if (!username) {
        return;
      }

      setStoredUserLoading(true);
      try {
        const material = await loadStoredPublicKeyMaterial(username);
        if (!material) {
          throw new Error(`No public key found for ${username}.`);
        }

        setRecipientJwkText(formatEcPublicKeyText(material.publicJwk));
      } catch (e) {
        setRecipientPanelError(
          errorMessage(e, 'Failed to load stored user public key.'),
        );
      } finally {
        setStoredUserLoading(false);
      }
    },
    [onPeerLabelChange],
  );

  useEffect(() => {
    if (!recipientSelectRequest) {
      return;
    }

    const { username } = recipientSelectRequest;
    let cancelled = false;

    void (async () => {
      await handleSelectStoredUser(username);
      if (!cancelled) {
        onRecipientSelectHandled?.();
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [
    handleSelectStoredUser,
    onRecipientSelectHandled,
    recipientSelectRequest,
  ]);

  useEffect(() => {
    const loggedInUsername = user?.username;
    if (
      !loggedInUsername ||
      peerKeyIdToSelect ||
      storedUsersLoading ||
      lastRecipientRestoredForUserRef.current === loggedInUsername
    ) {
      return;
    }

    const savedRecipientUsername =
      loadLastOneToOneRecipientUsername(loggedInUsername);
    lastRecipientRestoredForUserRef.current = loggedInUsername;
    if (
      !savedRecipientUsername ||
      !storedUsernames.includes(savedRecipientUsername)
    ) {
      return;
    }

    let cancelled = false;

    void (async () => {
      setRecipientPanelError(null);
      setStoredUserLoading(true);

      try {
        const material = await loadStoredPublicKeyMaterial(
          savedRecipientUsername,
        );
        if (cancelled) {
          return;
        }
        if (!material) {
          throw new Error(`No public key found for ${savedRecipientUsername}.`);
        }

        setSelectedStoredUsername(savedRecipientUsername);
        setRecipientJwkText(formatEcPublicKeyText(material.publicJwk));
      } catch (e) {
        if (!cancelled) {
          setRecipientPanelError(
            errorMessage(e, 'Failed to load stored user public key.'),
          );
        }
      } finally {
        if (!cancelled) {
          setStoredUserLoading(false);
        }
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [user?.username, peerKeyIdToSelect, storedUsersLoading, storedUsernames]);

  const handleOpenEncryptDialog = useCallback(() => {
    setSenderEncryptError(null);
    setEncryptDialogOpen(true);
  }, []);

  const handleCloseEncryptDialog = useCallback(() => {
    if (senderEncryptBusy) {
      return;
    }
    setEncryptDialogOpen(false);
  }, [senderEncryptBusy]);

  const handleEncryptAs = useCallback(
    async (messageText: string): Promise<boolean> => {
      const side: ThreadSide = 'sender';
      const setError = setSenderEncryptError;
      const setBusy = setSenderEncryptBusy;

      const encryptorKeys = senderKeys;
      const peerKeys = recipientKeys;
      const roleLabel = senderTitle;
      const peerLabel = recipientTitle;

      setError(null);

      if (isElectronApp() && (!user?.username || !keys?.publicKeyJwk)) {
        setError('Sign in and wait for your public key to load.');
        return false;
      }

      if (!bothKeysValid) {
        setError('Both sender and recipient need valid public keys.');
        return false;
      }
      if (!encryptorKeys.publicKey || !encryptorKeys.keyId) {
        setError(`${roleLabel} public key is not ready.`);
        return false;
      }
      if (!peerKeys.publicKey || !peerKeys.keyId) {
        setError(`${peerLabel} public key is not ready.`);
        return false;
      }

      const encryptorKeyId = encryptorKeys.keyId;
      const encryptorPublicKey = encryptorKeys.publicKey;

      const plaintext = messageText.trim();
      if (!plaintext) {
        setError('Enter a message to encrypt.');
        return false;
      }

      const recipients: ManifestRecipientKeys[] = [
        {
          keyId: peerKeys.keyId,
          publicKey: peerKeys.publicKey,
        },
      ];

      setBusy(true);
      try {
        await withUploadedPrivateKey(async (material) => {
          assertUploadedPrivateKeyMatchesKeyId(
            material,
            encryptorKeyId,
            `Uploaded private key does not match the ${roleLabel} publicKeyJwk.`,
          );

          const payload = await encryptWithManifest(
            plaintext,
            recipients,
            encryptorPublicKey,
            material.ecdsaSignPrivateKey,
          );
          if (peerKeys.jwk && peerKeys.keyId) {
            await saveStoredPublicKey(
              peerKeys.keyId,
              slimEcPublicJwk(peerKeys.jwk),
            );
          }
          const encryptedAt = Date.now();
          await onEncryptedMessage(
            {
              id: crypto.randomUUID(),
              createdAt: encryptedAt,
              encryptedAt,
              side,
              encryptedPayload: payload,
            },
            side,
            plaintext,
          );
          await copyAndNotify(payload);
        });
        return true;
      } catch (e) {
        if (isPrivateKeyFileSelectionCancelled(e)) {
          return false;
        }
        setError(errorMessage(e, 'Encryption failed.'));
        return false;
      } finally {
        setBusy(false);
      }
    },
    [
      bothKeysValid,
      senderKeys,
      recipientKeys,
      senderTitle,
      recipientTitle,
      user?.username,
      keys?.publicKeyJwk,
      onEncryptedMessage,
      copyAndNotify,
    ],
  );

  const handleEncryptFromDialog = useCallback(
    async (message: string) => {
      const success = await handleEncryptAs(message);
      if (success) {
        setEncryptDialogOpen(false);
      }
    },
    [handleEncryptAs],
  );

  if (keys?.loading) {
    return (
      <Box sx={{ display: 'flex', alignItems: 'center', gap: 2, py: 2 }}>
        <CircularProgress size={24} />
        <Typography variant="body2" color="text.secondary">
          Loading keys…
        </Typography>
      </Box>
    );
  }

  return (
    <>
      <Box
        sx={{
          display: 'flex',
          flexDirection: 'row',
          alignItems: 'stretch',
        }}
      >
        <OneToOneComposeSidePanel
          title={recipientTitle}
          titleOnRight
          titleAction={
            <Chip
              label="Change recipient"
              size="small"
              variant="outlined"
              clickable
              disabled={storedUsersLoading || recipientPickerBusy}
              onClick={() => setRecipientDialogOpen(true)}
            />
          }
          publicKeyJwkText={recipientJwkText}
          jwkError={recipientKeys.jwkError}
          jwkImporting={recipientKeys.importing}
          keysValid={recipientKeys.isValid}
          bothKeysValid={bothKeysValid}
          actionError={recipientPanelError ?? storedUsersError}
          actionBusy={importBusy}
          primaryActionMode="import"
          onPrimaryAction={onImportMessage}
          publicKeySectionCollapsed={publicKeySectionCollapsed}
        />

        <Box
          sx={{
            display: 'flex',
            alignItems: 'center',
            alignSelf: 'stretch',
            position: 'relative',
            px: 1.5,
          }}
        >
          <Divider orientation="vertical" flexItem sx={{ height: '100%' }} />
        </Box>
        <Divider />

        <OneToOneComposeSidePanel
          title={senderTitle}
          titleAction={
            <Chip
              label="Logged in user"
              size="small"
              variant="outlined"
              disabled
            />
          }
          publicKeyJwkText={senderJwkTextForInput}
          jwkError={senderKeys.jwkError}
          jwkImporting={senderKeys.importing}
          keysValid={senderKeys.isValid}
          bothKeysValid={bothKeysValid}
          actionError={senderEncryptError}
          actionBusy={senderEncryptBusy}
          onPrimaryAction={handleOpenEncryptDialog}
          publicKeySectionCollapsed={publicKeySectionCollapsed}
        />
      </Box>

      <Divider>
        <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.5 }}>
          {publicKeySectionCollapsed && (
            <Tooltip title="Import message">
              <span>
                <IconButton
                  size="small"
                  aria-label="Import message"
                  disabled={!importActionEnabled}
                  onClick={onImportMessage}
                >
                  <CloudDownloadOutlinedIcon fontSize="small" />
                </IconButton>
              </span>
            </Tooltip>
          )}
          {threadActions}
          {publicKeySectionCollapsed && (
            <Tooltip title="Encrypt message">
              <span>
                <IconButton
                  size="small"
                  aria-label="Encrypt message"
                  disabled={!encryptActionEnabled}
                  onClick={handleOpenEncryptDialog}
                >
                  <SendAndArchiveOutlinedIcon fontSize="small" />
                </IconButton>
              </span>
            </Tooltip>
          )}
        </Box>
      </Divider>

      <RecipientPickerDialogs
        open={recipientDialogOpen}
        onClose={() => setRecipientDialogOpen(false)}
        selectedUsername={selectedStoredUsername}
        loadingSelection={storedUserLoading}
        onRecipientChosen={handleSelectStoredUser}
        onBusyChange={setRecipientPickerBusy}
      />

      <EncryptMessageDialog
        open={encryptDialogOpen}
        roleLabel={senderTitle}
        encrypting={senderEncryptBusy}
        error={senderEncryptError}
        onClose={handleCloseEncryptDialog}
        onMessageChange={() => setSenderEncryptError(null)}
        onEncrypt={(message) => void handleEncryptFromDialog(message)}
      />
      <CopiedToClipboardSnackbar {...snackbarProps} />
    </>
  );
}
