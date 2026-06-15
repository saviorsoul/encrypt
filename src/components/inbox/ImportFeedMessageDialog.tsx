import React, {
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
} from 'react';
import Alert from '@mui/material/Alert';
import Box from '@mui/material/Box';
import Button from '@mui/material/Button';
import CircularProgress from '@mui/material/CircularProgress';
import { AppDialog } from '@/components/shared/AppDialog.tsx';
import DialogActions from '@mui/material/DialogActions';
import DialogContent from '@mui/material/DialogContent';
import DialogTitle from '@mui/material/DialogTitle';
import Stack from '@mui/material/Stack';
import Tab from '@mui/material/Tab';
import Tabs from '@mui/material/Tabs';
import TextField from '@mui/material/TextField';
import Typography from '@mui/material/Typography';
import UploadFileOutlinedIcon from '@mui/icons-material/UploadFileOutlined';
import { MessageFeedCard } from '@/components/inbox/MessageFeedCard.tsx';
import { useImportFeedMessage } from '@/hooks/useImportFeedMessage.ts';
import { useImportMessagePreview } from '@/hooks/useImportMessagePreview.ts';
import {
  readValidatedImportJsonFromFile,
  validateImportJsonText,
} from '@/utils/readImportJsonFile.ts';
import type { StoredMessage } from '@/services/db/storedMessages.ts';

type ImportFeedMessageDialogProps = {
  open: boolean;
  recipientKeyId: string | null;
  existingMessages: StoredMessage[];
  onClose: () => void;
  onImported?: (message: StoredMessage) => void;
  initialPayload?: string | null;
  initialFileName?: string | null;
};

type ImportTab = 'json' | 'file';
type ImportStep = 'input' | 'preview';

export function ImportFeedMessageDialog({
  open,
  recipientKeyId,
  existingMessages,
  onClose,
  onImported,
  initialPayload = null,
  initialFileName = null,
}: ImportFeedMessageDialogProps) {
  const [tab, setTab] = useState<ImportTab>('json');
  const [step, setStep] = useState<ImportStep>('input');
  const [payload, setPayload] = useState('');
  const [selectedFileName, setSelectedFileName] = useState<string | null>(null);
  const [fileError, setFileError] = useState<string | null>(null);
  const [prevOpen, setPrevOpen] = useState(open);
  const fileInputRef = useRef<HTMLInputElement>(null);

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
    step === 'preview' && payload.trim().length > 0 ? payload.trim() : null;

  const {
    previewMessage,
    senderLabel,
    error: previewError,
    loading: previewLoading,
  } = useImportMessagePreview(previewManifest, step === 'preview');

  if (open !== prevOpen) {
    setPrevOpen(open);
    if (open) {
      setTab('json');
      setFileError(null);
      clearError();
      if (initialPayload) {
        setPayload(initialPayload);
        setSelectedFileName(initialFileName);
        setStep('preview');
      } else {
        setStep('input');
        setPayload('');
        setSelectedFileName(null);
      }
    }
  }

  const trimmedPayload = payload.trim();
  const payloadError = useMemo(() => {
    if (step !== 'input' || tab !== 'json' || !trimmedPayload) {
      return null;
    }
    return validatePayloadText(trimmedPayload);
  }, [step, tab, trimmedPayload, validatePayloadText]);

  const importValidationError = useMemo(() => {
    if (step !== 'input' || tab !== 'json' || !trimmedPayload || payloadError) {
      return null;
    }
    return validateForImport(trimmedPayload);
  }, [step, tab, trimmedPayload, payloadError, validateForImport]);

  const canPreviewFromJson =
    step === 'input' &&
    tab === 'json' &&
    trimmedPayload.length > 0 &&
    payloadError === null &&
    importValidationError === null;

  const openFilePicker = useCallback(() => {
    fileInputRef.current?.click();
  }, []);

  const goToPreview = useCallback(
    (manifestText: string) => {
      const validated = validateImportJsonText(manifestText);
      if (validated.ok === false) {
        if (tab === 'file') {
          setFileError(validated.error);
        }
        return;
      }

      const importValidationError = validateForImport(validated.text);
      if (importValidationError) {
        if (tab === 'file') {
          setFileError(importValidationError);
        } else {
          clearError();
        }
        return;
      }

      setPayload(validated.text);
      setFileError(null);
      clearError();
      setStep('preview');
    },
    [tab, validateForImport, clearError],
  );

  const handleFileChange = useCallback(
    (event: React.ChangeEvent<HTMLInputElement>) => {
      const file = event.target.files?.[0] ?? null;
      event.target.value = '';

      setFileError(null);
      clearError();

      if (!file) {
        setSelectedFileName(null);
        return;
      }

      setSelectedFileName(file.name);

      void (async () => {
        const result = await readValidatedImportJsonFromFile(file);
        if (result.ok === false) {
          setSelectedFileName(null);
          setFileError(result.error);
          return;
        }

        goToPreview(result.text);
      })();
    },
    [clearError, goToPreview],
  );

  const handleTabChange = useCallback(
    (_event: React.SyntheticEvent, value: ImportTab) => {
      setTab(value);
      setFileError(null);
      clearError();
    },
    [clearError],
  );

  useEffect(() => {
    if (open && step === 'input' && tab === 'file') {
      openFilePicker();
    }
  }, [open, step, tab, openFilePicker]);

  const handlePreviewFromJson = useCallback(() => {
    goToPreview(trimmedPayload);
  }, [goToPreview, trimmedPayload]);

  const handleBack = useCallback(() => {
    setStep('input');
    clearError();
  }, [clearError]);

  const handleConfirmImport = useCallback(() => {
    void confirmImport(payload);
  }, [confirmImport, payload]);

  const previewBusy = previewLoading || busy;

  return (
    <AppDialog open={open} onClose={onClose} fullWidth maxWidth="sm">
      <DialogTitle>
        {step === 'input' ? 'Import message' : 'Preview import'}
      </DialogTitle>
      <DialogContent>
        <Stack spacing={2} sx={{ pt: 0.5 }}>
          {step === 'input' ? (
            <>
              <Typography variant="body2" color="text.secondary">
                Add an encrypted feed message from a manifest JSON file or by
                pasting the signed payload. Your public key must be listed as a
                recipient.
              </Typography>

              <Tabs
                value={tab}
                onChange={handleTabChange}
                aria-label="Import message method"
              >
                <Tab label="Paste JSON" value="json" />
                <Tab label="From file" value="file" />
              </Tabs>

              <input
                ref={fileInputRef}
                type="file"
                accept=".json,application/json"
                hidden
                onChange={handleFileChange}
              />

              {tab === 'file' ? (
                <Stack spacing={1.5}>
                  <Button
                    variant="outlined"
                    startIcon={<UploadFileOutlinedIcon />}
                    onClick={openFilePicker}
                    disabled={busy}
                  >
                    Choose JSON file
                  </Button>
                  <Typography variant="body2" color="text.secondary">
                    {selectedFileName
                      ? `Selected: ${selectedFileName}`
                      : 'Select a signed manifest JSON file.'}
                  </Typography>
                  {fileError && <Alert severity="error">{fileError}</Alert>}
                </Stack>
              ) : (
                <TextField
                  autoFocus
                  label="Encrypted JSON"
                  value={payload}
                  onChange={(event) => {
                    setPayload(event.target.value);
                    clearError();
                  }}
                  fullWidth
                  multiline
                  minRows={12}
                  disabled={busy}
                  placeholder="Paste signed manifest JSON…"
                  error={Boolean(payloadError)}
                  helperText={
                    payloadError ??
                    'Paste the full signed manifest JSON exported from encryption.'
                  }
                  slotProps={{
                    input: {
                      sx: { fontFamily: 'monospace', fontSize: '0.75rem' },
                    },
                  }}
                />
              )}

              {importValidationError && tab === 'json' && (
                <Alert severity="error">{importValidationError}</Alert>
              )}

              {importError && tab === 'json' && (
                <Alert severity="error">{importError}</Alert>
              )}
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
            {tab === 'json' && (
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
