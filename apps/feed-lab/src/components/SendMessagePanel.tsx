import React, { useCallback, useState } from 'react';
import {
  Alert,
  Box,
  Button,
  CircularProgress,
  Paper,
  Snackbar,
  Stack,
  TextField,
  ToggleButton,
  ToggleButtonGroup,
  Typography,
} from '@mui/material';
import SendIcon from '@mui/icons-material/Send';
import ContentCopyOutlinedIcon from '@mui/icons-material/ContentCopyOutlined';
import { RecipientMultiSelect } from '@/components/encrypt/RecipientMultiSelect.tsx';
import { ImportJsonPayloadInput } from '@/components/shared/ImportJsonPayloadInput.tsx';
import { CopiedToClipboardSnackbar } from '@/components/CopiedToClipboardSnackbar.tsx';
import { validateJsonSyntaxText } from '@lab/lib/validateJsonSyntax.ts';
import { useSendImportToBackend } from '@lab/hooks/useSendImportToBackend.ts';
import { useBackendSendMessage } from '@lab/hooks/useBackendSendMessage.ts';
import type { useFeedLabRecipients } from '@lab/hooks/useFeedLabRecipients.ts';
import type { usePrivateKeySession } from '@lab/hooks/usePrivateKeySession.ts';

type SendMode = 'message' | 'json';

type SendMessagePanelProps = {
  withPrivateKey: ReturnType<typeof usePrivateKeySession>['withPrivateKey'];
  keyId: string | null;
  recipients: ReturnType<typeof useFeedLabRecipients>;
  onSendSuccess: () => Promise<void>;
};

export function SendMessagePanel({
  withPrivateKey,
  keyId,
  recipients,
  onSendSuccess,
}: SendMessagePanelProps) {
  const importSend = useSendImportToBackend();
  const sendMessage = useBackendSendMessage(withPrivateKey, keyId);
  const [importPayload, setImportPayload] = useState('');
  const [copyNotice, setCopyNotice] = useState<{
    open: boolean;
    severity: 'success' | 'error';
    key: number;
  }>({ open: false, severity: 'success', key: 0 });
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
    const messageId = await sendMessage.sendMessage(
      messageText,
      recipients.recipients,
    );
    if (messageId) {
      setMessageText('');
      await onSendSuccess();
    }
  }, [sendMessage, messageText, recipients.recipients, onSendSuccess]);

  const handleMessageTextChange = useCallback(
    (event: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) => {
      setMessageText(event.target.value);
      if (sendMessage.error) {
        sendMessage.clearError();
      }
    },
    [sendMessage],
  );

  const handleCloseSentSnackbar = useCallback(() => {
    sendMessage.clearLastMessageId();
  }, [sendMessage]);

  const handleCopySentMessage = useCallback(async () => {
    if (!sendMessage.lastMessageCopyPayload) {
      return;
    }

    try {
      await navigator.clipboard.writeText(sendMessage.lastMessageCopyPayload);
      setCopyNotice((prev) => ({
        open: true,
        severity: 'success',
        key: prev.key + 1,
      }));
    } catch {
      setCopyNotice((prev) => ({
        open: true,
        severity: 'error',
        key: prev.key + 1,
      }));
    }
  }, [sendMessage.lastMessageCopyPayload]);

  const handleCloseCopyNotice = useCallback(() => {
    setCopyNotice((prev) => ({ ...prev, open: false }));
  }, []);

  return (
    <Paper sx={{ p: 2 }}>
      <Stack
        direction="row"
        sx={{
          mb: 2,
          justifyContent: 'space-between',
          alignItems: 'center',
          flexWrap: 'wrap',
          gap: 1,
        }}
      >
        <Typography variant="h6">Send Message</Typography>
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

          <Box
            sx={{
              display: 'flex',
              gap: 2,
              alignItems: 'center',
              flexWrap: 'wrap',
            }}
          >
            {recipients.loadingFriends || recipients.loadingRecipientKeys ? (
              <Box
                sx={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: 1.5,
                  flex: 1,
                }}
              >
                <CircularProgress size={20} />
                <Typography variant="body2" color="text.secondary">
                  Loading recipients…
                </Typography>
              </Box>
            ) : recipients.recipientOptions.length === 0 ? (
              <Typography
                variant="body2"
                color="text.secondary"
                sx={{ flex: 1 }}
              >
                No friends yet. Add or accept a friend on the Users page before
                messaging.
              </Typography>
            ) : (
              <RecipientMultiSelect
                options={recipients.recipientOptions}
                value={recipients.selectedKeyIds}
                onChange={recipients.setSelectedKeyIds}
                getOptionLabel={recipients.getOptionLabel}
              />
            )}

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
              mt: 2,
            }}
          >
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

      <Snackbar
        key={sendMessage.lastMessageId ?? 'message-sent'}
        open={sendMessage.lastMessageId !== null}
        autoHideDuration={5000}
        onClose={handleCloseSentSnackbar}
        anchorOrigin={{ vertical: 'top', horizontal: 'center' }}
      >
        <Alert
          severity="success"
          variant="filled"
          onClose={handleCloseSentSnackbar}
          action={
            <Button
              color="inherit"
              size="small"
              startIcon={<ContentCopyOutlinedIcon />}
              onClick={() => void handleCopySentMessage()}
            >
              Copy
            </Button>
          }
          sx={{ width: '100%' }}
        >
          Message sent: {sendMessage.lastMessageId}
        </Alert>
      </Snackbar>

      <CopiedToClipboardSnackbar
        open={copyNotice.open}
        severity={copyNotice.severity}
        snackbarKey={copyNotice.key}
        onClose={handleCloseCopyNotice}
      />
    </Paper>
  );
}
