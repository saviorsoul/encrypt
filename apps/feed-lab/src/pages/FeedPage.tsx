import React, { useCallback, useEffect, useRef, useState } from 'react';
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
import { useBackendFeedData } from '@lab/hooks/useBackendFeedData.ts';
import { useSendImportToBackend } from '@lab/hooks/useSendImportToBackend.ts';
import { useBackendDecrypt } from '@lab/hooks/useBackendDecrypt.ts';
import { useBackendComments } from '@lab/hooks/useBackendComments.ts';
import { useBackendShare } from '@lab/hooks/useBackendShare.ts';
import { useFeedLabFriendships } from '@lab/hooks/useFeedLabFriendships.ts';
import { useFeedLabRecipients } from '@lab/hooks/useFeedLabRecipients.ts';
import { useBackendSendMessage } from '@lab/hooks/useBackendSendMessage.ts';
import { MessageThreadCard } from '@lab/components/MessageThreadCard.tsx';
import { ShareMessageDialog } from '@lab/components/ShareMessageDialog.tsx';
import { useFeedLabSession } from '@lab/providers/FeedLabSessionProvider.tsx';

type SendMode = 'message' | 'json';

export function FeedPage() {
  const { keys, feedLabUsers } = useFeedLabSession();
  const { usernameByKeyId } = feedLabUsers;
  const feed = useBackendFeedData(keys.keyId);
  const importSend = useSendImportToBackend();
  const [importPayload, setImportPayload] = useState('');
  const [sendMode, setSendMode] = useState<SendMode>('message');
  const [messageText, setMessageText] = useState('');
  const [selectedMessageId, setSelectedMessageId] = useState<string | null>(
    null,
  );
  const [commentText, setCommentText] = useState('');
  const [shareDialogOpen, setShareDialogOpen] = useState(false);

  const friendships = useFeedLabFriendships(keys.keyId, usernameByKeyId);
  const recipients = useFeedLabRecipients({
    friends: friendships.friends,
    loadingFriends: friendships.loading,
    friendsError: friendships.error,
  });
  const sendMessage = useBackendSendMessage(keys.withPrivateKey, keys.keyId);
  const decrypt = useBackendDecrypt(keys.withPrivateKey);
  const share = useBackendShare(keys.withPrivateKey);
  const comments = useBackendComments(
    selectedMessageId,
    keys.keyId,
    keys.withPrivateKey,
  );
  const selectedCommentIds = comments.comments
    .map((comment) => comment.id)
    .join('\0');
  const prevCommentIdsRef = useRef('');

  useEffect(() => {
    const prev = prevCommentIdsRef.current;
    if (prev && prev !== selectedCommentIds) {
      decrypt.clearDecryptedComments();
    }
    prevCommentIdsRef.current = selectedCommentIds;
  }, [selectedCommentIds, decrypt.clearDecryptedComments]);

  const handleToggleMessage = useCallback(
    (messageId: string) => {
      setSelectedMessageId((current) => {
        const next = current === messageId ? null : messageId;
        if (next !== current) {
          setCommentText('');
          decrypt.clear();
        }
        return next;
      });
    },
    [decrypt],
  );

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

  const handleSendMessage = useCallback(async () => {
    const messageId = await sendMessage.sendMessage(
      messageText,
      recipients.recipients,
    );
    if (messageId) {
      setMessageText('');
      if (keys.keyId) {
        await feed.reload(keys.keyId);
      }
    }
  }, [sendMessage, messageText, recipients.recipients, feed, keys.keyId]);

  return (
    <>
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
              onChange={(event) => {
                setMessageText(event.target.value);
                sendMessage.clearError();
                sendMessage.clearLastMessageId();
              }}
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
                  No friends yet. Add or accept a friend on the Users page
                  before messaging.
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
            {sendMessage.lastMessageId ? (
              <Alert severity="success">
                Message sent: {sendMessage.lastMessageId}
              </Alert>
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
          keyId from a private JWK file; the private key is not stored. Decrypt
          and comment actions prompt for your key each time.
        </Typography>
        {feed.error ? <Alert severity="warning">{feed.error}</Alert> : null}
        {feed.loading ? (
          <Stack direction="row" spacing={1} sx={{ alignItems: 'center' }}>
            <CircularProgress size={18} />
            <Typography variant="body2">Loading inbox + comments…</Typography>
          </Stack>
        ) : null}
        {keys.keyId && !feed.loading ? (
          <Typography variant="body2" color="text.secondary" sx={{ mb: 2 }}>
            {feed.messages.length} message(s), {feed.totalComments} comment(s).
          </Typography>
        ) : null}
        <Stack spacing={1}>
          {feed.messages.map((message) => (
            <MessageThreadCard
              key={message.id}
              message={message}
              expanded={selectedMessageId === message.id}
              commentCount={feed.commentsByMessageId[message.id]?.length ?? 0}
              comments={
                selectedMessageId === message.id
                  ? (feed.commentsByMessageId[message.id] ?? [])
                  : []
              }
              commentsPostBusy={
                selectedMessageId === message.id && comments.postBusy
              }
              commentText={selectedMessageId === message.id ? commentText : ''}
              onCommentTextChange={setCommentText}
              onToggle={() => handleToggleMessage(message.id)}
              decrypt={decrypt}
              share={share}
              onOpenShare={() => setShareDialogOpen(true)}
              onPostComment={() =>
                comments
                  .postComment({
                    messageId: message.id,
                    allDeliveries: feed.allDeliveries,
                    manifestLookup: feed.manifestLookup,
                    text: commentText,
                  })
                  .then(async () => {
                    setCommentText('');
                    await handleReloadFeed();
                  })
              }
              feedContext={{
                allDeliveries: feed.allDeliveries,
                manifestLookup: feed.manifestLookup,
              }}
              usernameByKeyId={usernameByKeyId}
              viewerKeyId={keys.keyId}
            />
          ))}
          {keys.keyId && !feed.loading && feed.messages.length === 0 ? (
            <Typography color="text.secondary">
              No data yet for this keyId.
            </Typography>
          ) : null}
        </Stack>
      </Paper>

      <ShareMessageDialog
        open={shareDialogOpen}
        messageId={selectedMessageId}
        busy={share.busy}
        error={share.error}
        recipientOptions={recipients.recipientOptions}
        selectedRecipients={recipients.selectedKeyIds}
        onSelectedRecipientsChange={recipients.setSelectedKeyIds}
        getOptionLabel={recipients.getOptionLabel}
        recipients={recipients.recipients}
        loadingRecipients={
          recipients.loadingFriends || recipients.loadingRecipientKeys
        }
        recipientsError={recipients.error}
        onClose={() => setShareDialogOpen(false)}
        onClearError={share.clearError}
        onShare={(shareRecipients) =>
          selectedMessageId
            ? share
                .shareMessage({
                  messageId: selectedMessageId,
                  recipients: shareRecipients,
                  allDeliveries: feed.allDeliveries,
                  manifestLookup: feed.manifestLookup,
                })
                .then(async (shareId) => {
                  if (shareId && keys.keyId) {
                    await feed.reload(keys.keyId);
                  }
                  return shareId;
                })
            : Promise.resolve(null)
        }
      />
    </>
  );
}
