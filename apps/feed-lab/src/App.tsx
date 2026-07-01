import React, { useCallback, useEffect, useRef, useState } from 'react';
import {
  Alert,
  AppBar,
  Avatar,
  Box,
  Button,
  Chip,
  CircularProgress,
  Container,
  Collapse,
  Divider,
  Paper,
  Stack,
  TextField,
  ToggleButton,
  ToggleButtonGroup,
  Toolbar,
  Typography,
} from '@mui/material';
import SendIcon from '@mui/icons-material/Send';
import { RecipientMultiSelect } from '@/components/encrypt/RecipientMultiSelect.tsx';
import { GenerateRecipientDialog } from '@/components/one-to-one/GenerateRecipientDialog.tsx';
import { nameInitial } from '@/utils/nameInitial.ts';
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
import { useBackendShare } from '@lab/hooks/useBackendShare.ts';
import { useBackendAddUser } from '@lab/hooks/useBackendAddUser.ts';
import { useBackendGenerateUser } from '@lab/hooks/useBackendGenerateUser.ts';
import { useFeedLabUsers } from '@lab/hooks/useFeedLabUsers.ts';
import { useFeedLabRecipients } from '@lab/hooks/useFeedLabRecipients.ts';
import { useBackendSendMessage } from '@lab/hooks/useBackendSendMessage.ts';
import { ShareMessageDialog } from '@lab/components/ShareMessageDialog.tsx';
import { getCommentAuthorKeyIdFromPayload } from '@encrypt/core/crypto/commentCrypto';
import { getSenderKeyIdFromCorePayload } from '@encrypt/core/crypto/manifestDecrypt';
import { formatCommentAuthorLabel } from '@lab/lib/formatCommentAuthorLabel.ts';
import { sanitizeDisplayText } from '@lab/lib/sanitizeDisplayText.ts';
import type { StoredComment, StoredMessage } from '@encrypt/core/feed/types';

type SendMode = 'message' | 'json';

function FeedLabApp() {
  const apiUrl = getApiBaseUrl();
  const keys = usePrivateKeySession();
  const feed = useBackendFeedData(keys.keyId);
  const importSend = useSendImportToBackend();
  const [importPayload, setImportPayload] = useState('');
  const [sendMode, setSendMode] = useState<SendMode>('message');
  const [messageText, setMessageText] = useState('');
  const [addUserName, setAddUserName] = useState('');
  const [addUserPublicKey, setAddUserPublicKey] = useState('');
  const [generateDialogOpen, setGenerateDialogOpen] = useState(false);
  const [selectedMessageId, setSelectedMessageId] = useState<string | null>(
    null,
  );
  const [commentText, setCommentText] = useState('');
  const [shareDialogOpen, setShareDialogOpen] = useState(false);
  const feedLabUsers = useFeedLabUsers();
  const { addBackendUser, addLocalUser } = feedLabUsers;
  const handleUserRegistered = useCallback(
    (input: {
      keyId: string;
      username: string;
      publicKey: { x: string; y: string };
    }) => {
      addBackendUser({
        keyId: input.keyId,
        publicKey: input.publicKey,
      });
      addLocalUser({
        keyId: input.keyId,
        username: input.username,
      });
    },
    [addBackendUser, addLocalUser],
  );
  const addUser = useBackendAddUser(handleUserRegistered);
  const generateUser = useBackendGenerateUser(handleUserRegistered);
  const registerBusy = addUser.busy || generateUser.busy;
  const recipients = useFeedLabRecipients({
    availableUsernames: feedLabUsers.usernames,
    loadingUsers: feedLabUsers.loading,
    usersError: feedLabUsers.error,
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
    <Box sx={{ minHeight: '100vh', bgcolor: 'background.default' }}>
      <AppBar position="sticky">
        <Toolbar>
          <Typography variant="h6" sx={{ flexGrow: 1 }}>
            Feed Lab
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
              Register user
            </Typography>
            <Typography variant="body2" color="text.secondary" sx={{ mb: 2 }}>
              Register a recipient with a local name and public key, or generate
              a new key pair. Names are stored in this browser only; the backend
              stores keyId and publicKey.
            </Typography>
            <Stack spacing={2}>
              <TextField
                fullWidth
                label="Name"
                placeholder="Recipient name"
                value={addUserName}
                disabled={registerBusy}
                onChange={(event) => {
                  setAddUserName(event.target.value);
                  addUser.clearError();
                  addUser.clearInfo();
                  addUser.clearLastKeyId();
                  generateUser.clearInfo();
                  generateUser.clearLastKeyId();
                }}
              />
              <TextField
                fullWidth
                multiline
                minRows={2}
                label="Public key"
                placeholder='x;y or {"x":"…","y":"…"}'
                value={addUserPublicKey}
                disabled={registerBusy}
                onChange={(event) => {
                  setAddUserPublicKey(event.target.value);
                  addUser.clearError();
                  addUser.clearInfo();
                  addUser.clearLastKeyId();
                  generateUser.clearInfo();
                  generateUser.clearLastKeyId();
                }}
                onKeyDown={(event) => {
                  if (
                    event.key === 'Enter' &&
                    (event.metaKey || event.ctrlKey)
                  ) {
                    event.preventDefault();
                    void addUser.addUser(
                      addUserName.trim(),
                      addUserPublicKey.trim(),
                    );
                  }
                }}
              />
            </Stack>
            <Stack direction="row" spacing={1} sx={{ mt: 2 }}>
              <Button
                variant="outlined"
                disabled={registerBusy}
                onClick={() => {
                  generateUser.clearError();
                  generateUser.clearInfo();
                  generateUser.clearLastKeyId();
                  addUser.clearInfo();
                  addUser.clearLastKeyId();
                  setGenerateDialogOpen(true);
                }}
              >
                Generate user
              </Button>
              <Button
                variant="contained"
                disabled={
                  registerBusy ||
                  !addUserName.trim() ||
                  !addUserPublicKey.trim()
                }
                onClick={() =>
                  void addUser.addUser(
                    addUserName.trim(),
                    addUserPublicKey.trim(),
                  )
                }
              >
                {addUser.busy ? 'Registering…' : 'Add user'}
              </Button>
            </Stack>
            {generateUser.info ? (
              <Alert severity="info" sx={{ mt: 2 }}>
                {generateUser.info}
              </Alert>
            ) : null}
            {addUser.info ? (
              <Alert severity="info" sx={{ mt: 2 }}>
                {addUser.info}
              </Alert>
            ) : null}
            {addUser.error ? (
              <Alert severity="error" sx={{ mt: 2 }}>
                {addUser.error}
              </Alert>
            ) : null}
            {generateUser.lastKeyId && generateUser.lastUsername ? (
              <Alert severity="success" sx={{ mt: 2 }}>
                {generateUser.lastUsername} generated, private key downloaded,
                registered with keyId: {generateUser.lastKeyId}
              </Alert>
            ) : null}
            {addUser.lastKeyId ? (
              <Alert severity="success" sx={{ mt: 2 }}>
                {addUserName.trim()} registered with keyId: {addUser.lastKeyId}
              </Alert>
            ) : null}
          </Paper>

          <GenerateRecipientDialog
            open={generateDialogOpen}
            onClose={() => setGenerateDialogOpen(false)}
            existingUsernames={feedLabUsers.usernames}
            generating={generateUser.busy}
            error={generateUser.error}
            onNameChange={generateUser.clearError}
            onGenerate={(username) =>
              void generateUser.generateUser(username).then((keyId) => {
                if (keyId) {
                  setGenerateDialogOpen(false);
                }
              })
            }
          />

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
                  {recipients.loadingUsers ||
                  recipients.loadingRecipientKeys ? (
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
                  ) : feedLabUsers.usernames.length === 0 ? (
                    <Typography
                      variant="body2"
                      color="text.secondary"
                      sx={{ flex: 1 }}
                    >
                      No recipients yet. Register a user above to add one.
                    </Typography>
                  ) : (
                    <RecipientMultiSelect
                      options={feedLabUsers.usernames}
                      value={recipients.selectedUsernames}
                      onChange={recipients.setSelectedUsernames}
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
                      Paste or load JSON to POST to the backend. Syntax warnings
                      are informational only; the API validates the request
                      body.
                    </Typography>
                  }
                  placeholder="Paste signed manifest or share export JSON…"
                  getPayloadError={(text) =>
                    importSend.validatePayloadText(text)
                  }
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
                {feed.messages.length} message(s), {feed.totalComments}{' '}
                comment(s).
              </Typography>
            ) : null}
            <Stack spacing={1}>
              {feed.messages.map((message) => (
                <MessageThreadCard
                  key={message.id}
                  message={message}
                  expanded={selectedMessageId === message.id}
                  commentCount={
                    feed.commentsByMessageId[message.id]?.length ?? 0
                  }
                  comments={
                    selectedMessageId === message.id
                      ? (feed.commentsByMessageId[message.id] ?? [])
                      : []
                  }
                  commentsPostBusy={
                    selectedMessageId === message.id && comments.postBusy
                  }
                  commentText={
                    selectedMessageId === message.id ? commentText : ''
                  }
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
                  usernameByKeyId={feedLabUsers.usernameByKeyId}
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
            recipientOptions={feedLabUsers.usernames}
            selectedRecipients={recipients.selectedUsernames}
            onSelectedRecipientsChange={recipients.setSelectedUsernames}
            recipients={recipients.recipients}
            loadingRecipients={
              recipients.loadingUsers || recipients.loadingRecipientKeys
            }
            recipientsError={recipients.error}
            onClose={() => setShareDialogOpen(false)}
            onClearError={share.clearError}
            onShare={(recipients) =>
              selectedMessageId
                ? share
                    .shareMessage({
                      messageId: selectedMessageId,
                      recipients,
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
        </Stack>
      </Container>
    </Box>
  );
}

function MessageThreadCard({
  message,
  expanded,
  commentCount,
  comments,
  commentsPostBusy,
  commentText,
  onCommentTextChange,
  onToggle,
  decrypt,
  share,
  onOpenShare,
  onPostComment,
  feedContext,
  usernameByKeyId,
  viewerKeyId,
}: {
  message: StoredMessage;
  expanded: boolean;
  commentCount: number;
  comments: StoredComment[];
  commentsPostBusy: boolean;
  commentText: string;
  onCommentTextChange: (text: string) => void;
  onToggle: () => void;
  decrypt: ReturnType<typeof useBackendDecrypt>;
  share: ReturnType<typeof useBackendShare>;
  onOpenShare: () => void;
  onPostComment: () => Promise<void>;
  feedContext: {
    allDeliveries: Parameters<
      ReturnType<typeof useBackendDecrypt>['decryptDelivery']
    >[0]['allDeliveries'];
    manifestLookup: Parameters<
      ReturnType<typeof useBackendDecrypt>['decryptDelivery']
    >[0]['manifestLookup'];
  };
  usernameByKeyId: Record<string, string>;
  viewerKeyId: string | null;
}) {
  const [senderKeyId, setSenderKeyId] = useState<string | null>(null);
  const [senderLabel, setSenderLabel] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;

    void getSenderKeyIdFromCorePayload(message.payload).then((keyId) => {
      if (!cancelled) {
        setSenderKeyId(keyId);
        setSenderLabel(formatCommentAuthorLabel(keyId, usernameByKeyId));
      }
    });

    return () => {
      cancelled = true;
    };
  }, [message.payload, usernameByKeyId]);

  const isOwnMessage =
    viewerKeyId !== null && senderKeyId !== null && senderKeyId === viewerKeyId;

  return (
    <Paper
      variant="outlined"
      sx={{
        p: 1.5,
        borderColor: expanded ? 'primary.main' : undefined,
      }}
    >
      <Box onClick={onToggle} sx={{ cursor: 'pointer' }}>
        <Stack
          direction="row"
          sx={{ justifyContent: 'space-between', alignItems: 'center', gap: 1 }}
        >
          <Box
            sx={{
              display: 'flex',
              alignItems: 'center',
              gap: 1,
              minWidth: 0,
              flex: 1,
            }}
          >
            <Avatar
              sx={{
                width: 28,
                height: 28,
                fontSize: isOwnMessage ? '0.625rem' : '0.75rem',
                fontWeight: 600,
                flexShrink: 0,
              }}
            >
              {isOwnMessage ? 'ME' : nameInitial(senderLabel ?? '?')}
            </Avatar>
            {!isOwnMessage ? (
              <Typography variant="subtitle2" noWrap>
                {senderLabel ?? '…'}
              </Typography>
            ) : null}
          </Box>
          <Chip size="small" label={`${commentCount} comments`} />
        </Stack>
        <Typography variant="caption" color="text.secondary">
          {new Date(message.createdAt).toLocaleString()}
        </Typography>
      </Box>

      <Collapse in={expanded} timeout={200}>
        <Box onClick={(event) => event.stopPropagation()} sx={{ pt: 1.5 }}>
          <Divider sx={{ mb: 1.5 }} />

          <Stack direction="row" spacing={1}>
            <Button
              variant="outlined"
              size="small"
              disabled={decrypt.busy}
              onClick={() =>
                void decrypt.decryptDelivery({
                  delivery: message,
                  allDeliveries: feedContext.allDeliveries,
                  manifestLookup: feedContext.manifestLookup,
                  comments,
                })
              }
            >
              Decrypt message
            </Button>
            <Button
              variant="outlined"
              size="small"
              disabled={share.busy}
              onClick={onOpenShare}
            >
              Share message
            </Button>
          </Stack>

          {share.lastShareId ? (
            <Alert severity="success" sx={{ mt: 1 }}>
              Share created: {share.lastShareId}
            </Alert>
          ) : null}
          {decrypt.error ? (
            <Alert severity="error" sx={{ mt: 1 }}>
              {decrypt.error}
            </Alert>
          ) : null}
          {decrypt.plaintext ? (
            <Paper variant="outlined" sx={{ mt: 2, p: 1.5 }}>
              <Typography variant="body2" sx={{ whiteSpace: 'pre-wrap' }}>
                {sanitizeDisplayText(decrypt.plaintext)}
              </Typography>
            </Paper>
          ) : null}

          <Divider sx={{ my: 2 }}>
            <Typography variant="subtitle2">
              Comments ({commentCount})
            </Typography>
          </Divider>

          <Box sx={{ mb: 2, minHeight: 24 }}>
            {decrypt.decryptedComments !== null ? (
              <Stack spacing={1}>
                {comments.map((comment) => {
                  const text = decrypt.decryptedComments?.[comment.id];
                  if (!text) {
                    return null;
                  }
                  return (
                    <CommentRow
                      key={comment.id}
                      comment={comment}
                      text={text}
                      usernameByKeyId={usernameByKeyId}
                    />
                  );
                })}
                {commentCount > 0 &&
                Object.keys(decrypt.decryptedComments).length === 0 ? (
                  <Typography variant="body2" color="text.secondary">
                    Could not decrypt comments.
                  </Typography>
                ) : null}
              </Stack>
            ) : (
              <Typography variant="body2" color="text.secondary">
                {commentCount === 0
                  ? 'No comments yet.'
                  : `${commentCount} comment(s). Decrypt message to read them.`}
              </Typography>
            )}
          </Box>

          <TextField
            fullWidth
            multiline
            minRows={3}
            label="New comment"
            value={commentText}
            onChange={(event) => onCommentTextChange(event.target.value)}
            sx={{ mb: 1 }}
          />
          <Button
            variant="contained"
            size="small"
            disabled={commentsPostBusy || !commentText.trim()}
            onClick={() => void onPostComment()}
          >
            {commentsPostBusy ? 'Posting…' : 'Add comment'}
          </Button>
        </Box>
      </Collapse>
    </Paper>
  );
}

function CommentRow({
  comment,
  text,
  usernameByKeyId,
}: {
  comment: StoredComment;
  text: string;
  usernameByKeyId: Record<string, string>;
}) {
  const [authorLabel, setAuthorLabel] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;

    void getCommentAuthorKeyIdFromPayload(comment.payload).then(
      (authorKeyId) => {
        if (!cancelled) {
          setAuthorLabel(
            formatCommentAuthorLabel(authorKeyId, usernameByKeyId),
          );
        }
      },
    );

    return () => {
      cancelled = true;
    };
  }, [comment.payload, usernameByKeyId]);

  return (
    <Paper variant="outlined" sx={{ p: 1.5 }}>
      <Stack spacing={0.75}>
        <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
          <Avatar
            sx={{ width: 28, height: 28, fontSize: '0.75rem', fontWeight: 600 }}
          >
            {nameInitial(authorLabel ?? '?')}
          </Avatar>
          <Typography variant="caption" sx={{ fontWeight: 600 }}>
            {authorLabel ?? '...'}
          </Typography>
        </Box>
        <Typography variant="body2" sx={{ whiteSpace: 'pre-wrap' }}>
          {text}
        </Typography>
      </Stack>
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
