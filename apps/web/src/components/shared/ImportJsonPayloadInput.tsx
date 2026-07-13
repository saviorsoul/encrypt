import React, { useCallback, useEffect, useRef, useState } from 'react';
import Alert from '@mui/material/Alert';
import Button from '@mui/material/Button';
import Stack from '@mui/material/Stack';
import Tab from '@mui/material/Tab';
import Tabs from '@mui/material/Tabs';
import TextField from '@mui/material/TextField';
import Typography from '@mui/material/Typography';
import UploadFileOutlinedIcon from '@mui/icons-material/UploadFileOutlined';
import { prettifyJsonText } from '@/utils/prettifyJsonText.ts';
import {
  readValidatedJsonFromFile,
  validateImportJsonText,
  type ValidatedImportJsonResult,
} from '@/utils/readImportJsonFile.ts';

type ImportTab = 'json' | 'file';

export type ImportJsonPayloadInputProps = {
  payload: string;
  onPayloadChange: (payload: string) => void;
  disabled?: boolean;
  /** Hide tabs and show a read-only payload field (external / preloaded import). */
  readOnly?: boolean;
  readOnlyFileName?: string | null;
  description?: React.ReactNode;
  readOnlyDescription?: React.ReactNode;
  placeholder?: string;
  pasteHelperText?: string | null;
  /** Returns an error message for the paste tab, or null when valid. */
  getPayloadError?: (trimmedPayload: string) => string | null;
  validateFileContent?: (text: string) => ValidatedImportJsonResult;
  /** Called after file content passes validation. Defaults to loading into the paste tab. */
  onFileContentLoaded?: (text: string, fileName: string) => void;
  onClearErrors?: () => void;
  autoOpenFilePicker?: boolean;
  rows?: number;
};

export function ImportJsonPayloadInput({
  payload,
  onPayloadChange,
  disabled = false,
  readOnly = false,
  readOnlyFileName = null,
  description,
  readOnlyDescription,
  placeholder,
  pasteHelperText = null,
  getPayloadError,
  validateFileContent = validateImportJsonText,
  onFileContentLoaded,
  onClearErrors,
  autoOpenFilePicker = true,
  rows = 14,
}: ImportJsonPayloadInputProps) {
  const [tab, setTab] = useState<ImportTab>('json');
  const [selectedFileName, setSelectedFileName] = useState<string | null>(null);
  const [fileError, setFileError] = useState<string | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const trimmedPayload = payload.trim();
  const payloadError =
    tab === 'json' && getPayloadError ? getPayloadError(trimmedPayload) : null;

  const openFilePicker = useCallback(() => {
    fileInputRef.current?.click();
  }, []);

  const handleDefaultFileContentLoaded = useCallback(
    (text: string) => {
      onPayloadChange(prettifyJsonText(text));
      setTab('json');
    },
    [onPayloadChange],
  );

  const handleFileLoaded =
    onFileContentLoaded ?? handleDefaultFileContentLoaded;

  const handleFileChange = useCallback(
    (event: React.ChangeEvent<HTMLInputElement>) => {
      const file = event.target.files?.[0] ?? null;
      event.target.value = '';

      setFileError(null);
      onClearErrors?.();

      if (!file) {
        setSelectedFileName(null);
        return;
      }

      setSelectedFileName(file.name);

      void (async () => {
        const result = await readValidatedJsonFromFile(
          file,
          validateFileContent,
        );
        if (result.ok === false) {
          setSelectedFileName(null);
          setFileError(result.error);
          return;
        }

        handleFileLoaded(result.text, file.name);
      })();
    },
    [handleFileLoaded, onClearErrors, validateFileContent],
  );

  const handleTabChange = useCallback(
    (_event: React.SyntheticEvent, value: ImportTab) => {
      setTab(value);
      setFileError(null);
      onClearErrors?.();
    },
    [onClearErrors],
  );

  useEffect(() => {
    if (readOnly || !autoOpenFilePicker) {
      return;
    }
    if (tab === 'file') {
      openFilePicker();
    }
  }, [autoOpenFilePicker, openFilePicker, readOnly, tab]);

  return (
    <Stack spacing={2}>
      {readOnly
        ? (readOnlyDescription ?? (
            <Typography variant="body2" color="text.secondary">
              {readOnlyFileName ? (
                <>
                  Review{' '}
                  <Typography
                    component="span"
                    variant="body2"
                    sx={{ fontWeight: 600 }}
                  >
                    {readOnlyFileName}
                  </Typography>
                  , then continue with the encrypted message below.
                </>
              ) : (
                <>Review the encrypted message below, then continue.</>
              )}
            </Typography>
          ))
        : description}

      {!readOnly ? (
        <Tabs
          value={tab}
          onChange={handleTabChange}
          aria-label="Import message method"
        >
          <Tab label="Paste JSON" value="json" />
          <Tab label="From file" value="file" />
        </Tabs>
      ) : null}

      <input
        ref={fileInputRef}
        type="file"
        accept=".json,application/json"
        hidden
        onChange={handleFileChange}
      />

      {tab === 'file' && !readOnly ? (
        <Stack spacing={1.5}>
          <Button
            variant="outlined"
            startIcon={<UploadFileOutlinedIcon />}
            onClick={openFilePicker}
            disabled={disabled}
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
          autoFocus={!readOnly}
          value={payload}
          onChange={(event) => {
            if (readOnly) {
              return;
            }
            onPayloadChange(event.target.value);
            onClearErrors?.();
          }}
          fullWidth
          multiline
          rows={rows}
          disabled={disabled || readOnly}
          placeholder={placeholder ? placeholder : 'Signed payload'}
          error={Boolean(payloadError)}
          helperText={payloadError ?? pasteHelperText}
          slotProps={{
            input: {
              sx: { fontFamily: 'monospace', fontSize: '0.75rem' },
            },
          }}
        />
      )}
    </Stack>
  );
}
