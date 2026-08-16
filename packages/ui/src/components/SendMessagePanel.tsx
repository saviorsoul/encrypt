import React, { memo, useCallback, useEffect, useRef, useState } from 'react';
import {
  Alert,
  Box,
  Button,
  CircularProgress,
  Paper,
  Stack,
  TextField,
  ToggleButton,
  ToggleButtonGroup,
  Typography,
} from '@mui/material';
import type { ManifestRecipientKeys } from '@encrypt/core/types/manifest';
import {
  encryptedContentCiphertextBase64Length,
  MAX_CONTENT_CIPHERTEXT_BASE64_LENGTH,
} from '@encrypt/core/constants/contentLimits';
import { ImportJsonPayloadInput } from './ImportJsonPayloadInput.tsx';
import { MessagePolicyOptions } from './MessagePolicyOptions.tsx';
import {
  useBackendSendMessage,
  type SendMessageKeysSession,
} from '../hooks/useBackendSendMessage.ts';
import { useSendImportToBackend } from '../hooks/useSendImportToBackend.ts';
import { validateJsonSyntaxText } from '../utils/validateJsonSyntaxText.ts';

export type SendMode = 'message' | 'json';

export type SendMessageRecipients = {
  loadingFriends: boolean;
  loadingRecipientKeys: boolean;
  recipientOptions: string[];
  error: string | null;
  recipients: ManifestRecipientKeys[];
};

type MessageDraftStatus = {
  ciphertextLength: number;
  overLimit: boolean;
  hasText: boolean;
};

const MESSAGE_DRAFT_STATUS_DEBOUNCE_MS = 100;

function useMessageDraft() {
  const textRef = useRef('');
  const [resetKey, setResetKey] = useState(0);
  const [status, setStatus] = useState<MessageDraftStatus>({
    ciphertextLength: 0,
    overLimit: false,
    hasText: false,
  });
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const updateDraft = useCallback((text: string) => {
    textRef.current = text;

    if (debounceRef.current) {
      clearTimeout(debounceRef.current);
    }

    debounceRef.current = setTimeout(() => {
      const ciphertextLength = text
        ? encryptedContentCiphertextBase64Length(text)
        : 0;
      setStatus({
        ciphertextLength,
        overLimit: ciphertextLength > MAX_CONTENT_CIPHERTEXT_BASE64_LENGTH,
        hasText: Boolean(text.trim()),
      });
    }, MESSAGE_DRAFT_STATUS_DEBOUNCE_MS);
  }, []);

  const clearDraft = useCallback(() => {
    textRef.current = '';
    if (debounceRef.current) {
      clearTimeout(debounceRef.current);
      debounceRef.current = null;
    }
    setStatus({
      ciphertextLength: 0,
      overLimit: false,
      hasText: false,
    });
    setResetKey((current) => current + 1);
  }, []);

  useEffect(
    () => () => {
      if (debounceRef.current) {
        clearTimeout(debounceRef.current);
      }
    },
    [],
  );

  return { textRef, status, updateDraft, clearDraft, resetKey };
}

type SendMessageTextFieldProps = {
  resetKey: number;
  disabled: boolean;
  error: boolean;
  helperText: string;
  onDraftChange: (text: string) => void;
};

const SendMessageTextField = memo(function SendMessageTextField({
  resetKey,
  disabled,
  error,
  helperText,
  onDraftChange,
}: SendMessageTextFieldProps) {
  const [value, setValue] = useState('');

  useEffect(() => {
    setValue('');
  }, [resetKey]);

  const handleChange = useCallback(
    (event: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) => {
      const next = event.target.value;
      setValue(next);
      onDraftChange(next);
    },
    [onDraftChange],
  );

  return (
    <TextField
      label="Message"
      value={value}
      onChange={handleChange}
      multiline
      minRows={5}
      fullWidth
      placeholder="Enter text to encrypt..."
      disabled={disabled}
      error={error}
      helperText={helperText}
      slotProps={{
        input: {
          sx: (theme) => ({
            fontSize: theme.typography.body2.fontSize,
          }),
        },
      }}
    />
  );
});

type UseSendMessageFormInput<
  TKeys extends SendMessageKeysSession,
  TRecipients extends SendMessageRecipients,
> = {
  keys: TKeys;
  recipients: TRecipients;
  onSendSuccess: () => Promise<void>;
  onMessageSent?: (detail: {
    messageId: string;
    copyPayload: string | null;
  }) => void;
};

export function useSendMessageForm<
  TKeys extends SendMessageKeysSession,
  TRecipients extends SendMessageRecipients,
>({
  keys,
  recipients,
  onSendSuccess,
  onMessageSent,
}: UseSendMessageFormInput<TKeys, TRecipients>) {
  const importSend = useSendImportToBackend();
  const {
    busy: sendBusy,
    error: sendError,
    sendMessage,
    clearError,
  } = useBackendSendMessage(keys, keys.keyId);
  const [sendMode, setSendMode] = useState<SendMode>('message');
  const importPayloadRef = useRef('');
  const [importFieldResetKey, setImportFieldResetKey] = useState(0);
  const [importHasText, setImportHasText] = useState(false);
  const { textRef, status, updateDraft, clearDraft, resetKey } =
    useMessageDraft();

  const handleSendImport = useCallback(async () => {
    const ok = await importSend.sendImport(importPayloadRef.current.trim());
    if (ok) {
      importPayloadRef.current = '';
      setImportHasText(false);
      setImportFieldResetKey((current) => current + 1);
      await onSendSuccess();
    }
  }, [importSend, onSendSuccess]);

  const handleImportPayloadChange = useCallback((text: string) => {
    setImportHasText(Boolean(text.trim()));
  }, []);

  const handleSendMessage = useCallback(async () => {
    const sent = await sendMessage(textRef.current, recipients.recipients);
    if (sent) {
      clearDraft();
      onMessageSent?.({
        messageId: sent.id,
        copyPayload: sent.copyPayload,
      });
      await onSendSuccess();
    }
  }, [
    sendMessage,
    recipients.recipients,
    clearDraft,
    onMessageSent,
    onSendSuccess,
  ]);

  const handleMessageDraftChange = useCallback(
    (text: string) => {
      updateDraft(text);
      if (sendError) {
        clearError();
      }
    },
    [clearError, sendError, updateDraft],
  );

  const clearFormNotices = useCallback(() => {
    clearError();
    importSend.clearNotices();
  }, [clearError, importSend.clearNotices]);

  const busy = sendMode === 'message' ? sendBusy : importSend.busy;
  const canSendMessage =
    !sendBusy &&
    status.hasText &&
    !status.overLimit &&
    recipients.recipients.length > 0;
  const canSendImport = !importSend.busy && importHasText;

  return {
    sendMode,
    setSendMode,
    messageCiphertextLength: status.ciphertextLength,
    messageOverLimit: status.overLimit,
    messageFieldResetKey: resetKey,
    handleMessageDraftChange,
    handleImportPayloadChange,
    importFieldResetKey,
    importPayloadRef,
    handleSendMessage,
    handleSendImport,
    sendBusy,
    sendError,
    importSend,
    busy,
    canSendMessage,
    canSendImport,
    clearFormNotices,
  };
}

export type SendMessageForm = ReturnType<typeof useSendMessageForm>;

type SendMessagePanelProps<TRecipients extends SendMessageRecipients> = {
  variant?: 'paper' | 'plain';
  form: SendMessageForm;
  recipients: TRecipients;
  showActions?: boolean;
  onClose?: () => void;
};

export function SendMessagePanel<TRecipients extends SendMessageRecipients>({
  variant = 'paper',
  form,
  recipients,
  showActions = true,
  onClose,
}: SendMessagePanelProps<TRecipients>) {
  const {
    sendMode,
    setSendMode,
    messageCiphertextLength,
    messageOverLimit,
    messageFieldResetKey,
    handleMessageDraftChange,
    handleImportPayloadChange,
    importFieldResetKey,
    importPayloadRef,
    handleSendMessage,
    handleSendImport,
    sendBusy,
    sendError,
    importSend,
    busy,
    canSendMessage,
    canSendImport,
  } = form;

  const actionButtons =
    sendMode === 'message' ? (
      <>
        {onClose ? (
          <Button onClick={onClose} disabled={busy} sx={{ mr: 'auto' }}>
            Cancel
          </Button>
        ) : null}
        <Button
          type="button"
          variant="contained"
          disabled={!canSendMessage}
          onClick={() => void handleSendMessage()}
        >
          {sendBusy ? 'Sending…' : 'Send message'}
        </Button>
      </>
    ) : (
      <>
        {onClose ? (
          <Button onClick={onClose} disabled={busy} sx={{ mr: 'auto' }}>
            Cancel
          </Button>
        ) : null}
        <Button
          type="button"
          variant="contained"
          disabled={!canSendImport}
          onClick={() => void handleSendImport()}
        >
          {importSend.busy ? 'Sending…' : 'Send imported data'}
        </Button>
      </>
    );

  const content = (
    <>
      <Stack
        direction="row"
        sx={{
          mb: variant === 'plain' ? 1.5 : 2,
          justifyContent: variant === 'plain' ? 'flex-start' : 'space-between',
          alignItems: 'center',
          flexWrap: 'wrap',
          gap: 1,
        }}
      >
        {variant === 'paper' ? (
          <Typography variant="h6">Send Message</Typography>
        ) : null}
        <ToggleButtonGroup
          exclusive
          size="small"
          value={sendMode}
          onChange={(_, next: SendMode | null) => {
            if (next) {
              setSendMode(next);
            }
          }}
        >
          <ToggleButton
            value="message"
            sx={{
              paddingTop: '0.2em',
              paddingBottom: '0.2em',
            }}
          >
            Send message
          </ToggleButton>
          <ToggleButton
            value="json"
            sx={{
              paddingTop: '0.2em',
              paddingBottom: '0.2em',
            }}
          >
            Send JSON
          </ToggleButton>
        </ToggleButtonGroup>
      </Stack>

      {sendMode === 'message' ? (
        <Stack spacing={2} sx={variant === 'plain' ? { pt: 1 } : undefined}>
          <SendMessageTextField
            resetKey={messageFieldResetKey}
            disabled={sendBusy}
            error={messageOverLimit}
            helperText={`${messageCiphertextLength}/${MAX_CONTENT_CIPHERTEXT_BASE64_LENGTH} encrypted size`}
            onDraftChange={handleMessageDraftChange}
          />

          {recipients.loadingFriends || recipients.loadingRecipientKeys ? (
            <Box sx={{ display: 'flex', alignItems: 'center', gap: 1.5 }}>
              <CircularProgress size={20} />
              <Typography variant="body2" color="text.secondary">
                Loading recipients…
              </Typography>
            </Box>
          ) : recipients.recipientOptions.length === 0 ? (
            <Typography variant="body2" color="text.secondary">
              No friends yet. Add or accept a friend in Users before messaging.
            </Typography>
          ) : (
            <MessagePolicyOptions mode="create" />
          )}

          {showActions && variant !== 'plain' ? (
            <Box sx={{ display: 'flex', gap: 1 }}>{actionButtons}</Box>
          ) : null}

          {recipients.error ? (
            <Typography color="error" variant="body2">
              {recipients.error}
            </Typography>
          ) : null}
          {sendError ? <Alert severity="error">{sendError}</Alert> : null}
        </Stack>
      ) : (
        <Stack spacing={2} sx={variant === 'plain' ? { pt: 1 } : undefined}>
          <ImportJsonPayloadInput
            payload=""
            draftRef={importPayloadRef}
            resetKey={importFieldResetKey}
            onPayloadChange={handleImportPayloadChange}
            disabled={importSend.busy}
            description={
              <Typography variant="body2" color="text.secondary">
                Paste or load JSON to POST to the backend. Syntax warnings are
                informational only; the API validates the request body.
              </Typography>
            }
            getPayloadError={(text) => importSend.validatePayloadText(text)}
            validateFileContent={validateJsonSyntaxText}
            onClearErrors={importSend.clearError}
          />

          {showActions && variant !== 'plain' ? (
            <Box sx={{ display: 'flex', gap: 1 }}>{actionButtons}</Box>
          ) : null}

          {importSend.error ? (
            <Alert severity="error">{importSend.error}</Alert>
          ) : null}
          {importSend.lastResult ? (
            <Alert severity="success">{importSend.lastResult}</Alert>
          ) : null}
        </Stack>
      )}
    </>
  );

  if (variant === 'plain') {
    return content;
  }

  return <Paper sx={{ p: 2 }}>{content}</Paper>;
}

export function SendMessageDialogActions({
  form,
  onClose,
}: {
  form: SendMessageForm;
  onClose: () => void;
}) {
  const {
    sendMode,
    handleSendMessage,
    handleSendImport,
    sendBusy,
    importSend,
    busy,
    canSendMessage,
    canSendImport,
  } = form;

  return (
    <>
      <Button onClick={onClose} disabled={busy} sx={{ mr: 'auto' }}>
        Cancel
      </Button>
      {sendMode === 'message' ? (
        <Button
          type="button"
          variant="contained"
          disabled={!canSendMessage}
          onClick={() => void handleSendMessage()}
        >
          {sendBusy ? 'Sending…' : 'Send message'}
        </Button>
      ) : (
        <Button
          type="button"
          variant="contained"
          disabled={!canSendImport}
          onClick={() => void handleSendImport()}
        >
          {importSend.busy ? 'Sending…' : 'Send imported data'}
        </Button>
      )}
    </>
  );
}
