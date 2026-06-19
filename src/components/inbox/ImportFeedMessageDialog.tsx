import React, { useCallback, useMemo, useState } from 'react';
import Alert from '@mui/material/Alert';
import Box from '@mui/material/Box';
import Button from '@mui/material/Button';
import CircularProgress from '@mui/material/CircularProgress';
import { AppDialog } from '@/components/shared/AppDialog.tsx';
import DialogActions from '@mui/material/DialogActions';
import DialogContent from '@mui/material/DialogContent';
import DialogTitle from '@mui/material/DialogTitle';
import Stack from '@mui/material/Stack';
import Typography from '@mui/material/Typography';
import { MessageFeedCard } from '@/components/inbox/MessageFeedCard.tsx';
import { ImportJsonPayloadInput } from '@/components/shared/ImportJsonPayloadInput.tsx';
import { useImportFeedMessage } from '@/hooks/useImportFeedMessage.ts';
import { useImportMessagePreview } from '@/hooks/useImportMessagePreview.ts';
import { validateImportJsonText } from '@/utils/readImportJsonFile.ts';
import { prettifyJsonText } from '@/utils/prettifyJsonText.ts';
import type { StoredMessage } from '@/services/db/storedMessages.ts';

type ImportFeedMessageDialogProps = {
  open: boolean;
  recipientKeyId: string | null;
  existingMessages: StoredMessage[];
  onClose: () => void;
  onImported?: (message: StoredMessage) => void;
  initialPayload?: string | null;
  initialFileName?: string | null;
  externalImport?: boolean;
};

type ImportStep = 'input' | 'preview';

export function ImportFeedMessageDialog({
  open,
  recipientKeyId,
  existingMessages,
  onClose,
  onImported,
  initialPayload = null,
  initialFileName = null,
  externalImport = false,
}: ImportFeedMessageDialogProps) {
  const [step, setStep] = useState<ImportStep>('input');
  const [payload, setPayload] = useState('');
  const [prevOpen, setPrevOpen] = useState(open);

  const externalPayload = useMemo(() => {
    if (!externalImport || !initialPayload) {
      return null;
    }
    return prettifyJsonText(initialPayload);
  }, [externalImport, initialPayload]);

  const displayPayload = externalPayload ?? payload;

  const handleImported = useCallback(
    (message: StoredMessage) => {
      onImported?.(message);
      onClose();
    },
    [onClose, onImported],
  );

  const {
    error: importError,
    busy,
    confirmImport,
    validateForImport,
    clearError,
    validatePayloadText,
  } = useImportFeedMessage({
    recipientKeyId,
    existingMessages,
    onImported: handleImported,
  });

  const previewManifest =
    step === 'preview' && displayPayload.trim().length > 0
      ? displayPayload.trim()
      : null;

  const {
    previewMessage,
    senderLabel,
    error: previewError,
    loading: previewLoading,
  } = useImportMessagePreview(previewManifest, step === 'preview');

  if (open !== prevOpen) {
    setPrevOpen(open);
    if (open && !externalImport) {
      clearError();
      setStep('input');
      setPayload('');
    }
  }

  const trimmedPayload = displayPayload.trim();
  const payloadError = useMemo(() => {
    if (step !== 'input' || !trimmedPayload) {
      return null;
    }
    return validatePayloadText(trimmedPayload);
  }, [step, trimmedPayload, validatePayloadText]);

  const importValidationError = useMemo(() => {
    if (step !== 'input' || !trimmedPayload || payloadError) {
      return null;
    }
    return validateForImport(trimmedPayload);
  }, [step, trimmedPayload, payloadError, validateForImport]);

  const canImportFromExternal =
    externalImport &&
    step === 'input' &&
    trimmedPayload.length > 0 &&
    payloadError === null &&
    importValidationError === null &&
    !busy;

  const canPreviewFromJson =
    step === 'input' &&
    trimmedPayload.length > 0 &&
    payloadError === null &&
    importValidationError === null;

  const validateFeedFileContent = useCallback(
    (text: string) => {
      const validated = validateImportJsonText(text);
      if (validated.ok === false) {
        return validated;
      }

      const importValidationError = validateForImport(validated.text);
      if (importValidationError) {
        return { ok: false as const, error: importValidationError };
      }

      return validated;
    },
    [validateForImport],
  );

  const goToPreview = useCallback(
    (manifestText: string) => {
      setPayload(prettifyJsonText(manifestText));
      clearError();
      setStep('preview');
    },
    [clearError],
  );

  const handleFileContentLoaded = useCallback(
    (text: string) => {
      goToPreview(text);
    },
    [goToPreview],
  );

  const handlePreviewFromJson = useCallback(() => {
    const validated = validateImportJsonText(trimmedPayload);
    if (validated.ok === false) {
      return;
    }

    const importValidationError = validateForImport(validated.text);
    if (importValidationError) {
      clearError();
      return;
    }

    goToPreview(validated.text);
  }, [goToPreview, trimmedPayload, validateForImport, clearError]);

  const handleBack = useCallback(() => {
    setStep('input');
    clearError();
  }, [clearError]);

  const handleConfirmImport = useCallback(() => {
    void confirmImport(displayPayload);
  }, [confirmImport, displayPayload]);

  const previewBusy = previewLoading || busy;

  return (
    <AppDialog open={open} onClose={onClose} fullWidth maxWidth="sm">
      <DialogTitle>
        {externalImport
          ? 'Import message'
          : step === 'input'
            ? 'Import message'
            : 'Preview import'}
      </DialogTitle>
      <DialogContent>
        <Stack spacing={2} sx={{ pt: 0.5 }}>
          {step === 'input' ? (
            <>
              <ImportJsonPayloadInput
                payload={displayPayload}
                onPayloadChange={setPayload}
                disabled={busy}
                readOnly={externalImport}
                readOnlyFileName={initialFileName}
                description={
                  <Typography variant="body2" color="text.secondary">
                    Add an encrypted feed message from a manifest JSON file or
                    by pasting the signed payload. Your public key must be
                    listed as a recipient.
                  </Typography>
                }
                readOnlyDescription={
                  <Typography variant="body2" color="text.secondary">
                    {initialFileName ? (
                      <>
                        Review{' '}
                        <Typography
                          component="span"
                          variant="body2"
                          sx={{ fontWeight: 600 }}
                        >
                          {initialFileName}
                        </Typography>
                        , then import it into your feed. Your public key must be
                        listed as a recipient.
                      </>
                    ) : (
                      <>
                        Review the encrypted message below, then import it into
                        your feed. Your public key must be listed as a
                        recipient.
                      </>
                    )}
                  </Typography>
                }
                getPayloadError={(text) => {
                  if (!text) {
                    return null;
                  }
                  return validatePayloadText(text);
                }}
                validateFileContent={validateFeedFileContent}
                onFileContentLoaded={handleFileContentLoaded}
                onClearErrors={clearError}
              />

              {importValidationError && (
                <Alert severity="error">{importValidationError}</Alert>
              )}

              {importError && <Alert severity="error">{importError}</Alert>}
            </>
          ) : (
            <>
              <Typography variant="body2" color="text.secondary">
                This is how the message will appear in your feed.
              </Typography>

              {previewLoading ? (
                <Box
                  sx={{
                    display: 'flex',
                    alignItems: 'center',
                    gap: 1.5,
                    py: 2,
                  }}
                >
                  <CircularProgress size={20} />
                  <Typography variant="body2" color="text.secondary">
                    Loading preview…
                  </Typography>
                </Box>
              ) : previewMessage ? (
                <MessageFeedCard
                  message={previewMessage}
                  senderLabel={senderLabel}
                  decryption={{ text: null, error: null }}
                  preview
                />
              ) : null}

              {previewError && <Alert severity="error">{previewError}</Alert>}

              {importError && <Alert severity="error">{importError}</Alert>}
            </>
          )}
        </Stack>
      </DialogContent>
      <DialogActions sx={{ px: 3, pb: 2 }}>
        {step === 'input' ? (
          <>
            <Button onClick={onClose} disabled={busy}>
              Cancel
            </Button>
            {externalImport ? (
              <Button
                variant="contained"
                disabled={!canImportFromExternal}
                onClick={handleConfirmImport}
              >
                {busy ? 'Importing…' : 'Import message'}
              </Button>
            ) : (
              <Button
                variant="contained"
                disabled={!canPreviewFromJson}
                onClick={handlePreviewFromJson}
              >
                Preview
              </Button>
            )}
          </>
        ) : (
          <>
            <Button onClick={handleBack} disabled={previewBusy}>
              Back
            </Button>
            <Button
              variant="contained"
              disabled={previewBusy || !previewMessage}
              onClick={handleConfirmImport}
            >
              {busy ? 'Adding…' : 'Add to feed'}
            </Button>
          </>
        )}
      </DialogActions>
    </AppDialog>
  );
}
