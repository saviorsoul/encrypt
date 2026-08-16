import React, { memo, useCallback, useEffect, useRef, useState } from 'react';
import Alert from '@mui/material/Alert';
import Button from '@mui/material/Button';
import Stack from '@mui/material/Stack';
import Tab from '@mui/material/Tab';
import Tabs from '@mui/material/Tabs';
import TextField from '@mui/material/TextField';
import Typography from '@mui/material/Typography';
import UploadFileOutlinedIcon from '@mui/icons-material/UploadFileOutlined';
import { prettifyJsonText } from '@encrypt/core/utils/prettifyJsonText';
import {
  readValidatedJsonFromFile,
  validateImportJsonText,
  type ValidatedImportJsonResult,
} from '@encrypt/core/feed/readImportJsonFile';

type ImportTab = 'json' | 'file';

const PAYLOAD_CHANGE_DEBOUNCE_MS = 100;
const PAYLOAD_VALIDATION_DEBOUNCE_MS = 100;

export type ImportJsonPayloadInputProps = {
  payload: string;
  onPayloadChange: (payload: string) => void;
  disabled?: boolean;
  readOnly?: boolean;
  readOnlyFileName?: string | null;
  description?: React.ReactNode;
  readOnlyDescription?: React.ReactNode;
  placeholder?: string;
  pasteHelperText?: string | null;
  getPayloadError?: (trimmedPayload: string) => string | null;
  validateFileContent?: (text: string) => ValidatedImportJsonResult;
  onFileContentLoaded?: (text: string, fileName: string) => void;
  onClearErrors?: () => void;
  autoOpenFilePicker?: boolean;
  rows?: number;
  /** Optional ref kept in sync while typing for immediate submit reads. */
  draftRef?: React.RefObject<string | null>;
  /** Increment to clear the paste JSON field. */
  resetKey?: number;
};

type PasteJsonTextFieldProps = {
  value: string;
  disabled: boolean;
  readOnly: boolean;
  placeholder?: string;
  rows: number;
  payloadError: string | null;
  pasteHelperText: string | null;
  onValueChange: (value: string) => void;
};

const PasteJsonTextField = memo(function PasteJsonTextField({
  value,
  disabled,
  readOnly,
  placeholder,
  rows,
  payloadError,
  pasteHelperText,
  onValueChange,
}: PasteJsonTextFieldProps) {
  return (
    <TextField
      autoFocus={!readOnly}
      value={value}
      onChange={(event) => {
        if (readOnly) {
          return;
        }
        onValueChange(event.target.value);
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
  );
});

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
  draftRef,
  resetKey = 0,
}: ImportJsonPayloadInputProps) {
  const [tab, setTab] = useState<ImportTab>('json');
  const [selectedFileName, setSelectedFileName] = useState<string | null>(null);
  const [fileError, setFileError] = useState<string | null>(null);
  const [localPayload, setLocalPayload] = useState(payload);
  const [payloadError, setPayloadError] = useState<string | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const payloadDebounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const validationDebounceRef = useRef<ReturnType<typeof setTimeout> | null>(
    null,
  );
  const getPayloadErrorRef = useRef(getPayloadError);
  const tabRef = useRef(tab);

  getPayloadErrorRef.current = getPayloadError;
  tabRef.current = tab;

  const scheduleValidation = useCallback((text: string) => {
    const validate = getPayloadErrorRef.current;
    if (!validate) {
      setPayloadError(null);
      return;
    }

    if (validationDebounceRef.current) {
      clearTimeout(validationDebounceRef.current);
    }

    validationDebounceRef.current = setTimeout(() => {
      const trimmed = text.trim();
      setPayloadError(tabRef.current === 'json' ? validate(trimmed) : null);
    }, PAYLOAD_VALIDATION_DEBOUNCE_MS);
  }, []);

  const notifyPayloadChange = useCallback(
    (text: string, immediate = false) => {
      if (draftRef) {
        draftRef.current = text;
      }

      if (payloadDebounceRef.current) {
        clearTimeout(payloadDebounceRef.current);
        payloadDebounceRef.current = null;
      }

      if (immediate) {
        onPayloadChange(text);
        return;
      }

      payloadDebounceRef.current = setTimeout(() => {
        onPayloadChange(text);
      }, PAYLOAD_CHANGE_DEBOUNCE_MS);
    },
    [draftRef, onPayloadChange],
  );

  const applyPayload = useCallback(
    (text: string, immediate = false) => {
      setLocalPayload(text);
      notifyPayloadChange(text, immediate);
      scheduleValidation(text);
    },
    [notifyPayloadChange, scheduleValidation],
  );

  const handlePasteValueChange = useCallback(
    (value: string) => {
      applyPayload(value);
      onClearErrors?.();
    },
    [applyPayload, onClearErrors],
  );

  useEffect(() => {
    if (readOnly) {
      setLocalPayload(payload);
      scheduleValidation(payload);
      return;
    }

    // Parent passes payload="" while draftRef owns typed text (send JSON flow).
    if (draftRef && payload === '') {
      return;
    }

    setLocalPayload(payload);
    if (draftRef) {
      draftRef.current = payload;
    }
    scheduleValidation(payload);
  }, [draftRef, payload, readOnly, scheduleValidation]);

  const prevResetKeyRef = useRef(resetKey);
  useEffect(() => {
    if (resetKey === prevResetKeyRef.current) {
      return;
    }
    prevResetKeyRef.current = resetKey;

    setLocalPayload('');
    if (draftRef) {
      draftRef.current = '';
    }
    setPayloadError(null);
    if (payloadDebounceRef.current) {
      clearTimeout(payloadDebounceRef.current);
      payloadDebounceRef.current = null;
    }
    if (validationDebounceRef.current) {
      clearTimeout(validationDebounceRef.current);
      validationDebounceRef.current = null;
    }
    onPayloadChange('');
  }, [draftRef, onPayloadChange, resetKey]);

  useEffect(
    () => () => {
      if (payloadDebounceRef.current) {
        clearTimeout(payloadDebounceRef.current);
      }
      if (validationDebounceRef.current) {
        clearTimeout(validationDebounceRef.current);
      }
    },
    [],
  );

  const openFilePicker = useCallback(() => {
    fileInputRef.current?.click();
  }, []);

  const handleDefaultFileContentLoaded = useCallback(
    (text: string) => {
      applyPayload(prettifyJsonText(text), true);
      setTab('json');
    },
    [applyPayload],
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

  const pasteValue = readOnly ? payload : localPayload;
  const displayedPayloadError =
    tab === 'json' && getPayloadError ? payloadError : null;

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
        <PasteJsonTextField
          value={pasteValue}
          disabled={disabled}
          readOnly={readOnly}
          placeholder={placeholder}
          rows={rows}
          payloadError={displayedPayloadError}
          pasteHelperText={pasteHelperText}
          onValueChange={handlePasteValueChange}
        />
      )}
    </Stack>
  );
}
