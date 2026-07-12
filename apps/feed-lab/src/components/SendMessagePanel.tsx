import React, { useCallback, useState } from 'react';
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
import SendIcon from '@mui/icons-material/Send';
import { RecipientMultiSelect } from '@/components/encrypt/RecipientMultiSelect.tsx';
import { ImportJsonPayloadInput } from '@/components/shared/ImportJsonPayloadInput.tsx';
import { validateJsonSyntaxText } from '@lab/lib/validateJsonSyntax.ts';
import { useSendImportToBackend } from '@lab/hooks/useSendImportToBackend.ts';
import { useBackendSendMessage } from '@lab/hooks/useBackendSendMessage.ts';
import type { useFeedLabRecipients } from '@lab/hooks/useFeedLabRecipients.ts';
import type { usePrivateKeySession } from '@lab/hooks/usePrivateKeySession.ts';

type SendMode = 'message' | 'json';

type SendMessagePanelProps = {
  variant?: 'paper' | 'plain';
  withPrivateKey: ReturnType<typeof usePrivateKeySession>['withPrivateKey'];
  keyId: string | null;
  recipients: ReturnType<typeof useFeedLabRecipients>;
  onSendSuccess: () => Promise<void>;
  onMessageSent?: (detail: {
    messageId: string;
    copyPayload: string | null;
  }) => void;
  onClose?: () => void;
};

export function SendMessagePanel({
  variant = 'paper',
  withPrivateKey,
  keyId,
  recipients,
  onSendSuccess,
  onMessageSent,
  onClose,
}: SendMessagePanelProps) {
  const importSend = useSendImportToBackend();
  const sendMessage = useBackendSendMessage(withPrivateKey, keyId);
  const [importPayload, setImportPayload] = useState('');
  const [sendMode, setSendMode] = useState<SendMode>('message');
  const [messageText, setMessageText] = useState('');

  const handleSendImport = useCallback(async () => {
    const ok = await importSend.sendImport(importPayload.trim());
    if (ok) {
      setImportPayload('');
      await onSendSuccess();
    }
  }, [importSend, importPayload, onSendSuccess]);

  const handleSendMessage = useCallback(async () => {
    const sent = await sendMessage.sendMessage(
      messageText,
      recipients.recipients,
    );
    if (sent) {
      setMessageText('');
      onMessageSent?.({
        messageId: sent.id,
        copyPayload: sent.copyPayload,
      });
      await onSendSuccess();
    }
  }, [
    sendMessage,
    messageText,
    recipients.recipients,
    onMessageSent,
    onSendSuccess,
  ]);

  const handleMessageTextChange = useCallback(
    (event: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) => {
      setMessageText(event.target.value);
      if (sendMessage.error) {
        sendMessage.clearError();
      }
    },
    [sendMessage],
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
          <ToggleButton value="message">Send message</ToggleButton>
          <ToggleButton value="json">Send JSON</ToggleButton>
        </ToggleButtonGroup>
      </Stack>

      {sendMode === 'message' ? (
        <Stack spacing={2}>
          <TextField
            label="Message"
            value={messageText}
            onChange={handleMessageTextChange}
            multiline
            minRows={3}
            fullWidth
            placeholder="Enter text to encrypt..."
            disabled={sendMessage.busy}
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
          ) : variant === 'plain' ? (
            <RecipientMultiSelect
              options={recipients.recipientOptions}
              value={recipients.selectedKeyIds}
              onChange={recipients.setSelectedKeyIds}
              getOptionLabel={recipients.getOptionLabel}
            />
          ) : (
            <Box
              sx={{
                display: 'flex',
                gap: 2,
                alignItems: 'center',
                flexWrap: 'wrap',
              }}
            >
              <RecipientMultiSelect
                options={recipients.recipientOptions}
                value={recipients.selectedKeyIds}
                onChange={recipients.setSelectedKeyIds}
                getOptionLabel={recipients.getOptionLabel}
              />
              <Button
                variant="contained"
                startIcon={<SendIcon />}
                disabled={
                  sendMessage.busy ||
                  !messageText.trim() ||
                  recipients.recipients.length === 0
                }
                onClick={() => void handleSendMessage()}
                sx={{ flexShrink: 0, height: 40 }}
              >
                {sendMessage.busy ? 'Sending…' : 'Send message'}
              </Button>
            </Box>
          )}

          {variant === 'plain' ? (
            <Box sx={{ display: 'flex', justifyContent: 'flex-end', gap: 1 }}>
              {onClose ? (
                <Button variant="outlined" onClick={onClose}>
                  Close
                </Button>
              ) : null}
              <Button
                variant="contained"
                startIcon={<SendIcon />}
                disabled={
                  sendMessage.busy ||
                  !messageText.trim() ||
                  recipients.recipients.length === 0
                }
                onClick={() => void handleSendMessage()}
                sx={{ flexShrink: 0, height: 40 }}
              >
                {sendMessage.busy ? 'Sending…' : 'Send message'}
              </Button>
            </Box>
          ) : null}

          {recipients.error ? (
            <Typography color="error" variant="body2">
              {recipients.error}
            </Typography>
          ) : null}
          {sendMessage.error ? (
            <Alert severity="error">{sendMessage.error}</Alert>
          ) : null}
        </Stack>
      ) : (
        <>
          <ImportJsonPayloadInput
            payload={importPayload}
            onPayloadChange={setImportPayload}
            disabled={importSend.busy}
            description={
              <Typography variant="body2" color="text.secondary">
                Paste or load JSON to POST to the backend. Syntax warnings are
                informational only; the API validates the request body.
              </Typography>
            }
            placeholder="Paste signed manifest or share export JSON…"
            getPayloadError={(text) => importSend.validatePayloadText(text)}
            validateFileContent={validateJsonSyntaxText}
            onClearErrors={importSend.clearError}
          />
          <Box
            sx={{
              display: 'flex',
              justifyContent: 'flex-end',
              gap: 1,
              mt: 2,
            }}
          >
            {onClose ? (
              <Button onClick={onClose} sx={{ flexShrink: 0, height: 40 }}>
                Close
              </Button>
            ) : null}
            <Button
              variant="contained"
              startIcon={<SendIcon />}
              disabled={importSend.busy || !importPayload.trim()}
              onClick={() => void handleSendImport()}
              sx={{ flexShrink: 0, height: 40 }}
            >
              {importSend.busy ? 'Sending…' : 'Send imported data'}
            </Button>
          </Box>
          {importSend.error ? (
            <Alert severity="error" sx={{ mt: 2 }}>
              {importSend.error}
            </Alert>
          ) : null}
          {importSend.lastResult ? (
            <Alert severity="success" sx={{ mt: 2 }}>
              {importSend.lastResult}
            </Alert>
          ) : null}
        </>
      )}
    </>
  );

  if (variant === 'plain') {
    return content;
  }

  return <Paper sx={{ p: 2 }}>{content}</Paper>;
}
