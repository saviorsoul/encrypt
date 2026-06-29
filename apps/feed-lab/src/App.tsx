import React, { useCallback, useState } from 'react';
import {
  Alert,
  AppBar,
  Box,
  Button,
  Chip,
  CircularProgress,
  Container,
  Divider,
  Paper,
  Stack,
  TextField,
  Toolbar,
  Typography,
} from '@mui/material';
import { ImportJsonPayloadInput } from '@/components/shared/ImportJsonPayloadInput.tsx';
import { validateJsonSyntaxText } from '@lab/lib/validateJsonSyntax.ts';
import { FeedApiProvider } from '@lab/providers/FeedApiProvider.tsx';
import { getApiBaseUrl } from '@lab/lib/feedApiClient.ts';
import { shortPrivateKeyFileName } from '@lab/lib/shortPrivateKeyFileName.ts';
import { usePrivateKeySession } from '@lab/hooks/usePrivateKeySession.ts';
import { useBackendFeedData } from '@lab/hooks/useBackendFeedData.ts';
import { useSendImportToBackend } from '@lab/hooks/useSendImportToBackend.ts';
import { useBackendDecrypt } from '@lab/hooks/useBackendDecrypt.ts';
import { useBackendComments } from '@lab/hooks/useBackendComments.ts';
import type { StoredMessage } from '@encrypt/core/feed/types';

function FeedLabApp() {
  const apiUrl = getApiBaseUrl();
  const keys = usePrivateKeySession();
  const feed = useBackendFeedData(keys.keyId);
  const importSend = useSendImportToBackend();
  const [importPayload, setImportPayload] = useState('');
  const [selectedMessageId, setSelectedMessageId] = useState<string | null>(
    null,
  );
  const [commentText, setCommentText] = useState('');
  const decrypt = useBackendDecrypt(keys.withPrivateKey);
  const comments = useBackendComments(
    selectedMessageId,
    keys.keyId,
    keys.withPrivateKey,
  );

  const selectedMessage =
    feed.messages.find((message) => message.id === selectedMessageId) ?? null;

  const handleReloadFeed = useCallback(async () => {
    let recipientKeyId = keys.keyId;
    if (!recipientKeyId) {
      recipientKeyId = await keys.changeKeyId();
      if (!recipientKeyId) {
        return;
      }
    }
    await feed.reload(recipientKeyId);
  }, [keys, feed]);

  const handleSendImport = useCallback(async () => {
    const ok = await importSend.sendImport(importPayload.trim());
    if (ok) {
      setImportPayload('');
      if (keys.keyId) {
        await feed.reload(keys.keyId);
      }
    }
  }, [importSend, importPayload, feed, keys.keyId]);

  return (
    <Box sx={{ minHeight: '100vh', bgcolor: 'grey.50' }}>
      <AppBar position="static" color="default" elevation={1}>
        <Toolbar>
          <Typography variant="h6" sx={{ flexGrow: 1 }}>
            Encrypt Feed Lab
          </Typography>
          <Chip size="small" label={`API ${apiUrl}`} />
        </Toolbar>
      </AppBar>

      <Container maxWidth="md" sx={{ py: 3 }}>
        <Stack spacing={3}>
          <Stack
            direction="row"
            sx={{
              flexWrap: 'wrap',
              gap: 1,
              justifyContent: 'flex-end',
              alignItems: 'center',
            }}
          >
            {keys.keyId ? (
              <Chip
                size="small"
                label={`keyId ${keys.keyId.slice(0, 12)}...`}
              />
            ) : null}
            {keys.privateKeyFileName ? (
              <Chip
                size="small"
                label={`key ${shortPrivateKeyFileName(keys.privateKeyFileName)}`}
              />
            ) : null}
            <Button size="small" onClick={() => void keys.changeKeyId()}>
              {keys.keyId ? 'Change your keyId' : 'Set your keyId'}
            </Button>
          </Stack>

          <Paper sx={{ p: 2 }}>
            <Typography variant="h6" gutterBottom>
              Send JSON to backend
            </Typography>
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
            <Stack direction="row" spacing={1} sx={{ mt: 2 }}>
              <Button
                variant="contained"
                disabled={importSend.busy || !importPayload.trim()}
                onClick={() => void handleSendImport()}
              >
                {importSend.busy ? 'Sending…' : 'Send to backend'}
              </Button>
            </Stack>
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
          </Paper>

          <Paper sx={{ p: 2 }}>
            <Stack
              direction="row"
              sx={{
                mb: 2,
                justifyContent: 'space-between',
                alignItems: 'center',
              }}
            >
              <Typography variant="h6">Feed data for your keyId</Typography>
              <Button
                onClick={() => void handleReloadFeed()}
                disabled={feed.loading}
              >
                {feed.loading ? 'Loading…' : 'Reload all'}
              </Button>
            </Stack>
            <Typography variant="body2" color="text.secondary" sx={{ mb: 2 }}>
              Loads inbox and comments from the backend for your keyId. Set your
              keyId from a private JWK file; the private key is not stored.
              Decrypt and comment actions prompt for your key each time.
            </Typography>
            {feed.error ? <Alert severity="warning">{feed.error}</Alert> : null}
            {feed.loading ? (
              <Stack direction="row" spacing={1} sx={{ alignItems: 'center' }}>
                <CircularProgress size={18} />
                <Typography variant="body2">
                  Loading inbox + comments…
                </Typography>
              </Stack>
            ) : null}
            {keys.keyId && !feed.loading ? (
              <Typography variant="body2" color="text.secondary" sx={{ mb: 2 }}>
                {feed.rawItems.length} inbox row(s), {feed.totalComments}{' '}
                comment(s) across {feed.messages.length} thread(s).
              </Typography>
            ) : null}
            <Stack spacing={1}>
              {feed.messages.map((message) => (
                <MessageRow
                  key={message.id}
                  message={message}
                  selected={selectedMessageId === message.id}
                  commentCount={
                    feed.commentsByMessageId[message.id]?.length ?? 0
                  }
                  onSelect={() => setSelectedMessageId(message.id)}
                />
              ))}
              {keys.keyId && !feed.loading && feed.messages.length === 0 ? (
                <Typography color="text.secondary">
                  No data yet for this keyId.
                </Typography>
              ) : null}
            </Stack>
          </Paper>

          {selectedMessage ? (
            <Paper sx={{ p: 2 }}>
              <Typography variant="h6" gutterBottom>
                Thread: {selectedMessage.id}
              </Typography>
              <Button
                variant="outlined"
                disabled={decrypt.busy}
                onClick={() =>
                  void decrypt.decryptDelivery({
                    delivery: selectedMessage,
                    allDeliveries: feed.allDeliveries,
                    manifestLookup: feed.manifestLookup,
                  })
                }
              >
                Decrypt message
              </Button>
              {decrypt.error ? (
                <Alert severity="error" sx={{ mt: 1 }}>
                  {decrypt.error}
                </Alert>
              ) : null}
              {decrypt.plaintext ? (
                <TextField
                  fullWidth
                  multiline
                  minRows={3}
                  label="Plaintext"
                  value={decrypt.plaintext}
                  slotProps={{ input: { readOnly: true } }}
                  sx={{ mt: 2 }}
                />
              ) : null}

              <Divider sx={{ my: 2 }} />

              <Typography variant="subtitle1" gutterBottom>
                Comments ({comments.comments.length})
              </Typography>
              <Stack spacing={1} sx={{ mb: 2 }}>
                {comments.comments.map((comment) => (
                  <CommentRow
                    key={comment.id}
                    comment={comment}
                    onDecrypt={() =>
                      comments.decryptCommentText(comment, {
                        allDeliveries: feed.allDeliveries,
                        manifestLookup: feed.manifestLookup,
                      })
                    }
                  />
                ))}
              </Stack>
              <TextField
                fullWidth
                label="New comment"
                value={commentText}
                onChange={(event) => setCommentText(event.target.value)}
                sx={{ mb: 1 }}
              />
              <Button
                variant="contained"
                disabled={comments.postBusy || !commentText.trim()}
                onClick={() =>
                  void comments
                    .postComment({
                      messageId: selectedMessage.id,
                      allDeliveries: feed.allDeliveries,
                      manifestLookup: feed.manifestLookup,
                      text: commentText,
                    })
                    .then(async () => {
                      setCommentText('');
                      await handleReloadFeed();
                    })
                }
              >
                POST /api/comments
              </Button>
            </Paper>
          ) : null}
        </Stack>
      </Container>
    </Box>
  );
}

function MessageRow({
  message,
  selected,
  commentCount,
  onSelect,
}: {
  message: StoredMessage;
  selected: boolean;
  commentCount: number;
  onSelect: () => void;
}) {
  return (
    <Paper
      variant="outlined"
      sx={{
        p: 1.5,
        cursor: 'pointer',
        borderColor: selected ? 'primary.main' : undefined,
      }}
      onClick={onSelect}
    >
      <Stack
        direction="row"
        sx={{ justifyContent: 'space-between', alignItems: 'center' }}
      >
        <Typography variant="subtitle2">{message.id}</Typography>
        <Chip size="small" label={`${commentCount} comments`} />
      </Stack>
      <Typography variant="caption" color="text.secondary">
        {new Date(message.createdAt).toLocaleString()}
      </Typography>
    </Paper>
  );
}

function CommentRow({
  comment,
  onDecrypt,
}: {
  comment: { id: string; payload: string };
  onDecrypt: () => Promise<string | null>;
}) {
  const [text, setText] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  return (
    <Paper variant="outlined" sx={{ p: 1.5 }}>
      <Typography variant="caption">{comment.id}</Typography>
      <Button
        size="small"
        sx={{ mt: 1, display: 'block' }}
        onClick={() => {
          void onDecrypt()
            .then((value) => {
              if (value) {
                setText(value);
              }
            })
            .catch((e) =>
              setError(e instanceof Error ? e.message : 'Decrypt failed'),
            );
        }}
      >
        Decrypt
      </Button>
      {error ? <Alert severity="error">{error}</Alert> : null}
      {text ? <Typography sx={{ mt: 1 }}>{text}</Typography> : null}
    </Paper>
  );
}

export default function App() {
  return (
    <FeedApiProvider>
      <FeedLabApp />
    </FeedApiProvider>
  );
}
