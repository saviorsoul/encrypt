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
import { ChangeRecipientDialog } from '@/components/one-to-one/ChangeRecipientDialog.tsx';
import { EncryptMessageDialog } from '@/components/one-to-one/EncryptMessageDialog.tsx';
import { GenerateRecipientDialog } from '@/components/one-to-one/GenerateRecipientDialog.tsx';
import { SaveRecipientDialog } from '@/components/one-to-one/SaveRecipientDialog.tsx';
import { useKeysContext } from '@/hooks/useKeysContext.ts';
import { jwkWithoutKeyOps } from '@/crypto/ecdhKeys.ts';
import { createMockExternalRecipient } from '@/crypto/mockExternalRecipient.ts';
import { downloadJsonFile } from '@/utils/downloadJson.ts';
import { privateKeyDownloadFilename } from '@/utils/privateKeyFilename.ts';
import { useAuth } from '@/hooks/useAuth.ts';
import { usePublicKeyJwkInput } from '@/hooks/usePublicKeyJwkInput.ts';
import {
  encryptWithManifest,
  type ManifestRecipientKeys,
} from '@/crypto/manifestEncrypt.ts';
import { importPrivateKeyForEcdsaSign } from '@/crypto/ecdsaKeys.ts';
import {
  ecPublicJwkThumbprintSha256,
  slimEcPublicJwk,
} from '@/crypto/jwkThumbprint.ts';
import {
  isPrivateKeyFileSelectionCancelled,
  withUploadedPrivateKey,
} from '@/crypto/privateKeyFile.ts';
import {
  listStoredUsernames,
  loadStoredPublicKeyMaterial,
  loadStoredPublicKeyMaterialByKeyId,
  saveStoredPublicKey,
  saveStoredRecipientForUsername,
} from '@/services/db/storedPublicKeys.ts';
import { recoverPeerPublicJwkFromStoredThread } from '@/crypto/oneToOneMessageParties.ts';
import { errorMessage } from '@/utils/errorMessage.ts';
import {
  loadLastOneToOneRecipientUsername,
  resolveInitialOneToOneRecipientUsername,
  saveLastOneToOneRecipientUsername,
} from '@/utils/lastOneToOneRecipient.ts';
import { parsePublicKeyJwkText } from '@/utils/parsePublicKeyJwkText.ts';
import { useStoredUsernames } from '@/hooks/useStoredUsernames.ts';
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

  const senderKeys = usePublicKeyJwkInput(senderJwkText);
  const recipientKeys = usePublicKeyJwkInput(recipientJwkText);
  const {
    storedUsers,
    usernames: storedUsernames,
    allUsernames: allStoredUsernames,
    loading: storedUsersLoading,
    error: storedUsersError,
    refresh: refreshStoredUsernames,
  } = useStoredUsernames();

  const [selectedStoredUsername, setSelectedStoredUsername] = useState<
    string | null
  >(() => resolveInitialOneToOneRecipientUsername(user?.username));
  const recipientTitle = selectedStoredUsername ?? 'Recipient';
  const [storedUserLoading, setStoredUserLoading] = useState(false);
  const [recipientDialogOpen, setRecipientDialogOpen] = useState(false);
  const [saveRecipientDialogOpen, setSaveRecipientDialogOpen] = useState(false);
  const [saveRecipientBusy, setSaveRecipientBusy] = useState(false);
  const [saveRecipientError, setSaveRecipientError] = useState<string | null>(
    null,
  );
  const [generateRecipientDialogOpen, setGenerateRecipientDialogOpen] =
    useState(false);
  const [generateRecipientBusy, setGenerateRecipientBusy] = useState(false);
  const [generateRecipientError, setGenerateRecipientError] = useState<
    string | null
  >(null);
  const lastRecipientRestoredForUserRef = useRef<string | null>(null);

  const bothKeysValid = senderKeys.isValid && recipientKeys.isValid;
  const publicKeySectionCollapsed = thread.length > 0 || threadLoading;
  const importActionEnabled = !importBusy;
  const encryptActionEnabled =
    senderKeys.isValid &&
    !senderKeys.importing &&
    !senderEncryptBusy &&
    bothKeysValid;

  if (keys?.publicKeyJwk && !senderJwkPrefilled) {
    setSenderJwkText(
      JSON.stringify(slimEcPublicJwk(keys.publicKeyJwk), null, 2),
    );
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
        setRecipientJwkText(
          JSON.stringify(slimEcPublicJwk(material.publicJwk), null, 2),
        );
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

        setRecipientJwkText(
          JSON.stringify(slimEcPublicJwk(material.publicJwk), null, 2),
        );
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
        setRecipientJwkText(
          JSON.stringify(slimEcPublicJwk(material.publicJwk), null, 2),
        );
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

  const handleOpenGenerateRecipientDialog = useCallback(() => {
    setGenerateRecipientError(null);
    setGenerateRecipientDialogOpen(true);
  }, []);

  const handleGenerateRecipient = useCallback(
    async (username: string) => {
      setGenerateRecipientBusy(true);
      setGenerateRecipientError(null);
      setRecipientPanelError(null);

      try {
        const existingNames = await listStoredUsernames();
        if (existingNames.includes(username)) {
          setGenerateRecipientError(
            `"${username}" already exists. Choose a unique name.`,
          );
          return;
        }

        const mockRecipient = await createMockExternalRecipient();
        const [privateJwk, publicJwk] = await Promise.all([
          crypto.subtle.exportKey('jwk', mockRecipient.privateKey),
          crypto.subtle.exportKey('jwk', mockRecipient.publicKey),
        ]);
        const slimPublicJwk = slimEcPublicJwk(jwkWithoutKeyOps(publicJwk));

        await saveStoredRecipientForUsername(username, slimPublicJwk);
        await refreshStoredUsernames();

        downloadJsonFile(
          jwkWithoutKeyOps(privateJwk),
          privateKeyDownloadFilename(username),
        );

        setSelectedStoredUsername(username);
        onPeerLabelChange?.(username);
        setRecipientJwkText(JSON.stringify(slimPublicJwk, null, 2));
        setGenerateRecipientDialogOpen(false);
      } catch (e) {
        setGenerateRecipientError(
          errorMessage(e, 'Failed to generate recipient keys.'),
        );
      } finally {
        setGenerateRecipientBusy(false);
      }
    },
    [refreshStoredUsernames, onPeerLabelChange],
  );

  const handleOpenSaveRecipientDialog = useCallback(() => {
    setSaveRecipientError(null);
    setSaveRecipientDialogOpen(true);
  }, []);

  const handleSaveRecipient = useCallback(
    async (username: string, publicKeyJwkText: string) => {
      const parsed = parsePublicKeyJwkText(publicKeyJwkText);
      if (parsed.ok === false) {
        setSaveRecipientError(parsed.error);
        return;
      }

      setSaveRecipientBusy(true);
      setSaveRecipientError(null);
      try {
        const existingNames = await listStoredUsernames();
        if (existingNames.includes(username)) {
          setSaveRecipientError(
            `"${username}" already exists. Choose a unique name.`,
          );
          return;
        }

        const keyId = await ecPublicJwkThumbprintSha256(
          slimEcPublicJwk(parsed.jwk),
        );
        const existingKey = await loadStoredPublicKeyMaterialByKeyId(keyId);
        if (existingKey) {
          setSaveRecipientError(
            existingKey.username
              ? `This public key is already saved as "${existingKey.username}".`
              : 'This public key is already stored.',
          );
          return;
        }

        await saveStoredRecipientForUsername(username, parsed.jwk);
        await refreshStoredUsernames();
        setSelectedStoredUsername(username);
        onPeerLabelChange?.(username);
        setRecipientJwkText(JSON.stringify(parsed.jwk, null, 2));
        setSaveRecipientDialogOpen(false);
      } catch (e) {
        setSaveRecipientError(errorMessage(e, 'Failed to add recipient.'));
      } finally {
        setSaveRecipientBusy(false);
      }
    },
    [refreshStoredUsernames, onPeerLabelChange],
  );

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

      if (!bothKeysValid) {
        setError('Both sender and recipient need valid public key JWKs.');
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
        await withUploadedPrivateKey(async (_ecdhPrivateKey, privateJwk) => {
          const uploadedKeyId = await ecPublicJwkThumbprintSha256(
            slimEcPublicJwk(privateJwk),
          );
          if (uploadedKeyId !== encryptorKeys.keyId) {
            throw new Error(
              `Uploaded private key does not match the ${roleLabel} publicKeyJwk.`,
            );
          }

          const signingPrivateKey =
            await importPrivateKeyForEcdsaSign(privateJwk);
          const payload = await encryptWithManifest(
            plaintext,
            recipients,
            encryptorKeys.publicKey!,
            signingPrivateKey,
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
              label="Change Recipient"
              size="small"
              variant="outlined"
              clickable
              disabled={
                storedUsersLoading || generateRecipientBusy || saveRecipientBusy
              }
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
          publicKeyJwkText={senderJwkText}
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

      <ChangeRecipientDialog
        open={recipientDialogOpen}
        onClose={() => setRecipientDialogOpen(false)}
        usernames={storedUsernames}
        loading={storedUsersLoading}
        loadingSelection={storedUserLoading}
        error={storedUsersError}
        selectedUsername={selectedStoredUsername}
        onSelect={(username) => void handleSelectStoredUser(username)}
        onGenerate={handleOpenGenerateRecipientDialog}
        onAdd={handleOpenSaveRecipientDialog}
        generateDisabled={generateRecipientBusy}
        addDisabled={saveRecipientBusy}
      />

      <SaveRecipientDialog
        open={saveRecipientDialogOpen}
        onClose={() => setSaveRecipientDialogOpen(false)}
        existingUsernames={allStoredUsernames}
        existingUsers={storedUsers}
        saving={saveRecipientBusy}
        error={saveRecipientError}
        onFieldChange={() => setSaveRecipientError(null)}
        onSave={(username, publicKeyJwkText) =>
          void handleSaveRecipient(username, publicKeyJwkText)
        }
      />

      <GenerateRecipientDialog
        open={generateRecipientDialogOpen}
        onClose={() => setGenerateRecipientDialogOpen(false)}
        existingUsernames={allStoredUsernames}
        generating={generateRecipientBusy}
        error={generateRecipientError}
        onNameChange={() => setGenerateRecipientError(null)}
        onGenerate={(username) => void handleGenerateRecipient(username)}
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
