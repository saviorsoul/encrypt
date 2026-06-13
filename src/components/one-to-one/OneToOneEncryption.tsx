import React, { useCallback, useEffect, useState } from 'react';
import Box from '@mui/material/Box';
import Chip from '@mui/material/Chip';
import CircularProgress from '@mui/material/CircularProgress';
import Divider from '@mui/material/Divider';
import Tooltip from '@mui/material/Tooltip';
import Typography from '@mui/material/Typography';
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
} from '@/crypto/storedPublicKeys.ts';
import { recoverPeerPublicJwkFromStoredThread } from '@/crypto/oneToOneMessageParties.ts';
import { errorMessage } from '@/utils/errorMessage.ts';
import { parsePublicKeyJwkText } from '@/utils/parsePublicKeyJwkText.ts';
import { useStoredUsernames } from '@/hooks/useStoredUsernames.ts';
import { usePayloadCopiedSnackbar } from '@/hooks/usePayloadCopiedSnackbar.tsx';
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
  onPartyKeyIdsChange: (keyIds: PartyKeyIds) => void;
  onPeerLabelChange?: (label: string) => void;
};

export function OneToOneEncryption({
  thread,
  threadLoading = false,
  peerKeyIdToSelect = null,
  onPeerKeyIdSelected,
  onPeerNeedsName,
  onEncryptedMessage,
  onPartyKeyIdsChange,
  onPeerLabelChange,
}: OneToOneEncryptionProps) {
  const { user } = useAuth();
  const keys = useKeysContext();
  const { copyPayloadAndNotify, payloadCopiedSnackbar } =
    usePayloadCopiedSnackbar();

  const senderTitle = user?.username ?? 'Sender';
  const [recipientTitle, setRecipientTitle] = useState('Recipient');

  const [senderJwkText, setSenderJwkText] = useState('');
  const [recipientJwkText, setRecipientJwkText] = useState('');
  const [senderJwkPrefilled, setSenderJwkPrefilled] = useState(false);
  const [senderEncryptError, setSenderEncryptError] = useState<string | null>(
    null,
  );
  const [recipientEncryptError, setRecipientEncryptError] = useState<
    string | null
  >(null);
  const [senderEncryptBusy, setSenderEncryptBusy] = useState(false);
  const [recipientEncryptBusy, setRecipientEncryptBusy] = useState(false);
  const [encryptDialogSide, setEncryptDialogSide] = useState<ThreadSide | null>(
    null,
  );

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
  >(null);
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

  const bothKeysValid = senderKeys.isValid && recipientKeys.isValid;
  const publicKeySectionCollapsed = thread.length > 0 || threadLoading;

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
    if (!peerKeyIdToSelect) {
      return;
    }

    let cancelled = false;

    void (async () => {
      setRecipientEncryptError(null);
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
        setRecipientTitle(username);
        onPeerLabelChange?.(username);
        setRecipientJwkText(
          JSON.stringify(slimEcPublicJwk(material.publicJwk), null, 2),
        );
        onPeerKeyIdSelected?.();
      } catch (e) {
        if (!cancelled) {
          setRecipientEncryptError(
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
      setRecipientEncryptError(null);
      setRecipientTitle(username ?? 'Recipient');
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
        setRecipientEncryptError(
          errorMessage(e, 'Failed to load stored user public key.'),
        );
      } finally {
        setStoredUserLoading(false);
      }
    },
    [onPeerLabelChange],
  );

  const handleOpenGenerateRecipientDialog = useCallback(() => {
    setGenerateRecipientError(null);
    setGenerateRecipientDialogOpen(true);
  }, []);

  const handleGenerateRecipient = useCallback(
    async (username: string) => {
      setGenerateRecipientBusy(true);
      setGenerateRecipientError(null);
      setRecipientEncryptError(null);

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
        setRecipientTitle(username);
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
        setRecipientTitle(username);
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

  const handleOpenEncryptDialog = useCallback((side: ThreadSide) => {
    if (side === 'sender') {
      setSenderEncryptError(null);
    } else {
      setRecipientEncryptError(null);
    }
    setEncryptDialogSide(side);
  }, []);

  const handleCloseEncryptDialog = useCallback(() => {
    if (encryptDialogSide === 'sender' && senderEncryptBusy) {
      return;
    }
    if (encryptDialogSide === 'recipient' && recipientEncryptBusy) {
      return;
    }
    setEncryptDialogSide(null);
  }, [encryptDialogSide, senderEncryptBusy, recipientEncryptBusy]);

  const handleEncryptAs = useCallback(
    async (side: ThreadSide, messageText: string): Promise<boolean> => {
      const setError =
        side === 'sender' ? setSenderEncryptError : setRecipientEncryptError;
      const setBusy =
        side === 'sender' ? setSenderEncryptBusy : setRecipientEncryptBusy;

      const encryptorKeys = side === 'sender' ? senderKeys : recipientKeys;
      const peerKeys = side === 'sender' ? recipientKeys : senderKeys;
      const roleLabel = side === 'sender' ? senderTitle : recipientTitle;
      const peerLabel = side === 'sender' ? recipientTitle : senderTitle;

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
          await copyPayloadAndNotify(payload);
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
      copyPayloadAndNotify,
    ],
  );

  const handleEncryptFromDialog = useCallback(
    async (message: string) => {
      if (!encryptDialogSide) {
        return;
      }
      const success = await handleEncryptAs(encryptDialogSide, message);
      if (success) {
        setEncryptDialogSide(null);
      }
    },
    [encryptDialogSide, handleEncryptAs],
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
            <Box
              sx={{
                display: 'flex',
                alignItems: 'center',
                gap: 1,
                flexWrap: 'wrap',
              }}
            >
              <Chip
                label="Change"
                size="small"
                variant="outlined"
                clickable
                disabled={storedUsersLoading || storedUsernames.length === 0}
                onClick={() => setRecipientDialogOpen(true)}
              />
              <Tooltip title="Create a new recipient key pair">
                <span>
                  <Chip
                    label="Generate"
                    size="small"
                    variant="outlined"
                    clickable
                    disabled={generateRecipientBusy}
                    onClick={handleOpenGenerateRecipientDialog}
                  />
                </span>
              </Tooltip>
              <Tooltip title="Use existing public key">
                <span>
                  <Chip
                    label="Add"
                    size="small"
                    variant="outlined"
                    clickable
                    disabled={saveRecipientBusy}
                    onClick={handleOpenSaveRecipientDialog}
                  />
                </span>
              </Tooltip>
            </Box>
          }
          publicKeyJwkText={recipientJwkText}
          jwkError={recipientKeys.jwkError}
          jwkImporting={recipientKeys.importing}
          keysValid={recipientKeys.isValid}
          bothKeysValid={bothKeysValid}
          encryptError={recipientEncryptError ?? storedUsersError}
          encryptBusy={recipientEncryptBusy}
          onEncrypt={() => handleOpenEncryptDialog('recipient')}
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
          encryptError={senderEncryptError}
          encryptBusy={senderEncryptBusy}
          onEncrypt={() => handleOpenEncryptDialog('sender')}
          publicKeySectionCollapsed={publicKeySectionCollapsed}
        />
      </Box>

      <ChangeRecipientDialog
        open={recipientDialogOpen}
        onClose={() => setRecipientDialogOpen(false)}
        usernames={storedUsernames}
        loading={storedUsersLoading}
        loadingSelection={storedUserLoading}
        error={storedUsersError}
        selectedUsername={selectedStoredUsername}
        onSelect={(username) => void handleSelectStoredUser(username)}
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
        open={encryptDialogSide !== null}
        roleLabel={
          encryptDialogSide === 'sender'
            ? senderTitle
            : encryptDialogSide === 'recipient'
              ? recipientTitle
              : ''
        }
        encrypting={
          encryptDialogSide === 'sender'
            ? senderEncryptBusy
            : encryptDialogSide === 'recipient'
              ? recipientEncryptBusy
              : false
        }
        error={
          encryptDialogSide === 'sender'
            ? senderEncryptError
            : encryptDialogSide === 'recipient'
              ? recipientEncryptError
              : null
        }
        onClose={handleCloseEncryptDialog}
        onMessageChange={() => {
          if (encryptDialogSide === 'sender') {
            setSenderEncryptError(null);
          } else if (encryptDialogSide === 'recipient') {
            setRecipientEncryptError(null);
          }
        }}
        onEncrypt={(message) => void handleEncryptFromDialog(message)}
      />
      {payloadCopiedSnackbar}
    </>
  );
}
