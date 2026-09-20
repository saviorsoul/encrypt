import { useCallback, useEffect, useState } from 'react';
import { ChooseRecipientDialog } from '@/components/one-to-one/ChooseRecipientDialog.tsx';
import { GenerateRecipientDialog } from '@/components/one-to-one/GenerateRecipientDialog.tsx';
import { SaveRecipientDialog } from '@/components/one-to-one/SaveRecipientDialog.tsx';
import { jwkWithoutKeyOps } from '@/crypto/ecdhKeys.ts';
import { createMockExternalRecipient } from '@/crypto/mockExternalRecipient.ts';
import {
  ecPublicJwkThumbprintSha256,
  slimEcPublicJwk,
} from '@/crypto/jwkThumbprint.ts';
import { useStoredUsernames } from '@/hooks/useStoredUsernames.ts';
import {
  listStoredUsernames,
  loadStoredPublicKeyMaterialByKeyId,
  saveStoredRecipientForUsername,
} from '@/services/db/storedPublicKeys.ts';
import { downloadJsonFile } from '@/utils/downloadJson.ts';
import { errorMessage } from '@/utils/errorMessage.ts';
import { parsePublicKeyText } from '@/utils/parsePublicKeyText.ts';
import { privateKeyDownloadFilename } from '@/utils/privateKeyFilename.ts';

type RecipientPickerDialogsProps = {
  open: boolean;
  onClose: () => void;
  /** Backdrop / Escape on the choose dialog; defaults to {@link onClose}. */
  onDismiss?: () => void;
  selectedUsername?: string | null;
  loadingSelection?: boolean;
  onRecipientChosen: (username: string) => void | Promise<void>;
  onBusyChange?: (busy: boolean) => void;
};

export function RecipientPickerDialogs({
  open,
  onClose,
  onDismiss,
  selectedUsername = null,
  loadingSelection = false,
  onRecipientChosen,
  onBusyChange,
}: RecipientPickerDialogsProps) {
  const { storedUsers, usernames, allUsernames, loading, error, refresh } =
    useStoredUsernames();

  const [saveDialogOpen, setSaveDialogOpen] = useState(false);
  const [saveBusy, setSaveBusy] = useState(false);
  const [saveError, setSaveError] = useState<string | null>(null);
  const [generateDialogOpen, setGenerateDialogOpen] = useState(false);
  const [generateBusy, setGenerateBusy] = useState(false);
  const [generateError, setGenerateError] = useState<string | null>(null);

  const pickerBusy = saveBusy || generateBusy;

  useEffect(() => {
    onBusyChange?.(pickerBusy);
  }, [onBusyChange, pickerBusy]);

  useEffect(() => {
    if (open) {
      void refresh();
    }
  }, [open, refresh]);

  const handleOpenGenerateDialog = useCallback(() => {
    setGenerateError(null);
    setGenerateDialogOpen(true);
  }, []);

  const handleOpenSaveDialog = useCallback(() => {
    setSaveError(null);
    setSaveDialogOpen(true);
  }, []);

  const handleGenerateRecipient = useCallback(
    async (username: string) => {
      setGenerateBusy(true);
      setGenerateError(null);

      try {
        const existingNames = await listStoredUsernames();
        if (existingNames.includes(username)) {
          setGenerateError(
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
        await refresh();

        void downloadJsonFile(
          jwkWithoutKeyOps(privateJwk),
          privateKeyDownloadFilename(username),
        );

        setGenerateDialogOpen(false);
        await onRecipientChosen(username);
        onClose();
      } catch (caught) {
        setGenerateError(
          errorMessage(caught, 'Failed to generate recipient keys.'),
        );
      } finally {
        setGenerateBusy(false);
      }
    },
    [onClose, onRecipientChosen, refresh],
  );

  const handleSaveRecipient = useCallback(
    async (username: string, publicKeyJwkText: string) => {
      const parsed = parsePublicKeyText(publicKeyJwkText);
      if (parsed.ok === false) {
        setSaveError(parsed.error);
        return;
      }

      setSaveBusy(true);
      setSaveError(null);

      try {
        const existingNames = await listStoredUsernames();
        if (existingNames.includes(username)) {
          setSaveError(`"${username}" already exists. Choose a unique name.`);
          return;
        }

        const keyId = await ecPublicJwkThumbprintSha256(
          slimEcPublicJwk(parsed.jwk),
        );
        const existingKey = await loadStoredPublicKeyMaterialByKeyId(keyId);
        if (existingKey) {
          setSaveError(
            existingKey.username
              ? `This public key is already saved as "${existingKey.username}".`
              : 'This public key is already stored.',
          );
          return;
        }

        await saveStoredRecipientForUsername(username, parsed.jwk);
        await refresh();
        setSaveDialogOpen(false);
        await onRecipientChosen(username);
        onClose();
      } catch (caught) {
        setSaveError(errorMessage(caught, 'Failed to add recipient.'));
      } finally {
        setSaveBusy(false);
      }
    },
    [onClose, onRecipientChosen, refresh],
  );

  const handleSelect = useCallback(
    (username: string) => {
      void onRecipientChosen(username);
      onClose();
    },
    [onClose, onRecipientChosen],
  );

  return (
    <>
      <ChooseRecipientDialog
        open={open && !saveDialogOpen && !generateDialogOpen}
        onClose={onClose}
        onDismiss={onDismiss}
        usernames={usernames}
        loading={loading}
        loadingSelection={loadingSelection}
        error={error}
        selectedUsername={selectedUsername}
        onSelect={handleSelect}
        onGenerate={handleOpenGenerateDialog}
        onAdd={handleOpenSaveDialog}
        generateDisabled={generateBusy}
        addDisabled={saveBusy}
      />

      <SaveRecipientDialog
        open={saveDialogOpen}
        onClose={() => setSaveDialogOpen(false)}
        existingUsernames={allUsernames}
        existingUsers={storedUsers}
        saving={saveBusy}
        error={saveError}
        onFieldChange={() => setSaveError(null)}
        onSave={(username, publicKeyJwkText) =>
          void handleSaveRecipient(username, publicKeyJwkText)
        }
      />

      <GenerateRecipientDialog
        open={generateDialogOpen}
        onClose={() => setGenerateDialogOpen(false)}
        existingUsernames={allUsernames}
        generating={generateBusy}
        error={generateError}
        onNameChange={() => setGenerateError(null)}
        onGenerate={(username) => void handleGenerateRecipient(username)}
      />
    </>
  );
}
