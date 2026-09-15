import React, { memo, useCallback, useEffect, useRef, useState } from 'react';
import {
  Alert,
  Box,
  Button,
  Paper,
  Stack,
  TextField,
  ToggleButton,
  ToggleButtonGroup,
  Typography,
} from '@mui/material';
import type { ManifestRecipientKeys } from '@encrypt/core/types/manifest';
import {
  formatContentCharactersLeftCount,
  getContentPlaintextLimitState,
} from '@encrypt/core/constants/contentLimits';
import { ImportJsonPayloadInput } from './ImportJsonPayloadInput.tsx';
import { MessagePolicyOptionsReveal } from './MessagePolicyOptions.tsx';
import {
  useBackendSendMessage,
  type SendMessageKeysSession,
} from '../hooks/useBackendSendMessage.ts';
import { useSendImportToBackend } from '../hooks/useSendImportToBackend.ts';
import { isFeedInvitationalOnlyEnabled } from '@encrypt/core/feed/feedInvitationalOnlyConfig';
import { validateJsonSyntaxText } from '../utils/validateJsonSyntaxText.ts';

const allowSelfOnlyMessage = !isFeedInvitationalOnlyEnabled();

const MESSAGE_FIELD_MIN_ROWS = 5;
const MESSAGE_FIELD_VIEWPORT_CHROME_PX = 360;
const MESSAGE_FIELD_ROW_HEIGHT_PX = 23;

function useDialogMessageFieldMaxRows(
  minRows = MESSAGE_FIELD_MIN_ROWS,
): number {
  const [maxRows, setMaxRows] = useState(minRows);

  useEffect(() => {
    const syncMaxRows = () => {
      const availableHeight =
        window.innerHeight - MESSAGE_FIELD_VIEWPORT_CHROME_PX - 40;
      setMaxRows(
        Math.max(
          minRows,
          Math.floor(availableHeight / MESSAGE_FIELD_ROW_HEIGHT_PX),
        ),
      );
    };

    syncMaxRows();
    window.addEventListener('resize', syncMaxRows);
    return () => window.removeEventListener('resize', syncMaxRows);
  }, [minRows]);

  return maxRows;
}

export type SendMode = 'message' | 'json';

export type SendMessageRecipients = {
  loadingFriends: boolean;
  loadingRecipientKeys: boolean;
  recipientOptions: string[];
  error: string | null;
  recipients: ManifestRecipientKeys[];
};

type MessageDraftGate = {
  hasText: boolean;
  overLimit: boolean;
};

function useMessageDraft() {
  const textRef = useRef('');
  const [resetKey, setResetKey] = useState(0);
  const [sendGate, setSendGate] = useState<MessageDraftGate>({
    hasText: false,
    overLimit: false,
  });

  const updateDraft = useCallback((next: string, gate: MessageDraftGate) => {
    textRef.current = next;
    setSendGate((current) =>
      current.hasText === gate.hasText && current.overLimit === gate.overLimit
        ? current
        : gate,
    );
  }, []);

  const clearDraft = useCallback(() => {
    textRef.current = '';
    setSendGate({ hasText: false, overLimit: false });
    setResetKey((current) => current + 1);
  }, []);

  return { textRef, sendGate, updateDraft, clearDraft, resetKey };
}

type SendMessageTextFieldProps = {
  resetKey: number;
  disabled: boolean;
  onDraftChange: (text: string, gate: MessageDraftGate) => void;
  maxRows: number;
  scrollWhenFull?: boolean;
};

const SendMessageTextField = memo(function SendMessageTextField({
  resetKey,
  disabled,
  onDraftChange,
  maxRows,
  scrollWhenFull = false,
}: SendMessageTextFieldProps) {
  const [value, setValue] = useState('');
  const [limitState, setLimitState] = useState(() =>
    getContentPlaintextLimitState(''),
  );

  useEffect(() => {
    setValue('');
    setLimitState(getContentPlaintextLimitState(''));
  }, [resetKey]);

  const handleChange = useCallback(
    (event: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) => {
      const next = event.target.value;
      const nextLimit = getContentPlaintextLimitState(next);
      setValue(next);
      setLimitState(nextLimit);
      onDraftChange(next, {
        hasText: Boolean(next.trim()),
        overLimit: nextLimit.overLimit,
      });
    },
    [onDraftChange],
  );

  return (
    <TextField
      label="Message"
      value={value}
      onChange={handleChange}
      multiline
      minRows={MESSAGE_FIELD_MIN_ROWS}
      maxRows={maxRows}
      fullWidth
      placeholder="Enter text to encrypt..."
      disabled={disabled}
      error={limitState.overLimit}
      helperText={formatContentCharactersLeftCount(limitState.charactersLeft)}
      slotProps={{
        input: {
          sx: (theme) => ({
            fontSize: theme.typography.body2.fontSize,
            alignItems: 'flex-start',
          }),
        },
        ...(scrollWhenFull
          ? {
              htmlInput: {
                sx: {
                  overflow: 'auto !important',
                  resize: 'none',
                },
              },
            }
          : {}),
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
  const [submitted, setSubmitted] = useState(false);
  const { textRef, sendGate, updateDraft, clearDraft, resetKey } =
    useMessageDraft();
  const sendErrorRef = useRef(sendError);
  sendErrorRef.current = sendError;

  const handleSendImport = useCallback(async () => {
    const ok = await importSend.sendImport(importPayloadRef.current.trim());
    if (ok) {
      setSubmitted(true);
      await onSendSuccess();
    }
  }, [importSend, onSendSuccess]);

  const handleImportPayloadChange = useCallback((text: string) => {
    setImportHasText(Boolean(text.trim()));
  }, []);

  const handleSendMessage = useCallback(async () => {
    const sent = await sendMessage(textRef.current, recipients.recipients);
    if (sent) {
      setSubmitted(true);
      onMessageSent?.({
        messageId: sent.id,
        copyPayload: sent.copyPayload,
      });
      await onSendSuccess();
    }
  }, [sendMessage, recipients.recipients, onMessageSent, onSendSuccess]);

  const handleMessageDraftChange = useCallback(
    (text: string, gate: MessageDraftGate) => {
      updateDraft(text, gate);
      if (sendErrorRef.current) {
        clearError();
      }
    },
    [clearError, updateDraft],
  );

  const clearFormNotices = useCallback(() => {
    clearError();
    importSend.clearNotices();
  }, [clearError, importSend.clearNotices]);

  const clearForm = useCallback(() => {
    clearFormNotices();
    clearDraft();
    importPayloadRef.current = '';
    setImportHasText(false);
    setImportFieldResetKey((current) => current + 1);
    setSubmitted(false);
  }, [clearDraft, clearFormNotices]);

  const handleSendModeChange = useCallback(
    (next: SendMode) => {
      if (next === sendMode) {
        return;
      }
      clearDraft();
      importPayloadRef.current = '';
      setImportHasText(false);
      setImportFieldResetKey((current) => current + 1);
      clearFormNotices();
      setSendMode(next);
    },
    [clearDraft, clearFormNotices, sendMode],
  );

  const recipientsLoading =
    recipients.loadingFriends || recipients.loadingRecipientKeys;
  const busy =
    submitted || (sendMode === 'message' ? sendBusy : importSend.busy);
  const canSendMessage =
    !busy &&
    !recipientsLoading &&
    sendGate.hasText &&
    !sendGate.overLimit &&
    (recipients.recipients.length > 0 || allowSelfOnlyMessage);
  const canSendImport = !busy && importHasText;

  return {
    sendMode,
    setSendMode,
    handleSendModeChange,
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
    clearForm,
    recipientsLoading,
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
    handleSendModeChange,
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
    recipientsLoading,
  } = form;
  const hasFriendsForPolicy =
    recipients.recipientOptions.length > 0 || allowSelfOnlyMessage;
  const dialogMaxRows = useDialogMessageFieldMaxRows();

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
          flexShrink: 0,
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
              handleSendModeChange(next);
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
            disabled={busy || recipientsLoading}
            onDraftChange={handleMessageDraftChange}
            maxRows={variant === 'plain' ? dialogMaxRows : 10}
            scrollWhenFull={variant === 'plain'}
          />

          <MessagePolicyOptionsReveal
            loading={
              recipients.loadingFriends || recipients.loadingRecipientKeys
            }
            hasFriends={hasFriendsForPolicy}
            noFriendsMessage="No friends yet. Add or accept a friend in Users before messaging."
            mode="create"
          />

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
            disabled={busy}
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
