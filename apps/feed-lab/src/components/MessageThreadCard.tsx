import React, { memo, useCallback, useEffect, useMemo, useState } from 'react';
import {
  Alert,
  Avatar,
  Box,
  Button,
  CircularProgress,
  Collapse,
  Paper,
  Stack,
  TextField,
  Tooltip,
  Typography,
} from '@mui/material';
import type { Theme } from '@mui/material/styles';
import ChatBubbleOutlineOutlinedIcon from '@mui/icons-material/ChatBubbleOutlineOutlined';
import CheckIcon from '@mui/icons-material/Check';
import ContentCopyOutlinedIcon from '@mui/icons-material/ContentCopyOutlined';
import LockOutlinedIcon from '@mui/icons-material/LockOutlined';
import ShareOutlinedIcon from '@mui/icons-material/ShareOutlined';
import { useRelativeTime } from '@/hooks/useRelativeTime.ts';
import { nameInitial } from '@/utils/nameInitial.ts';
import type { CopyState } from '@/types/copyState.ts';
import { getCommentAuthorKeyIdFromPayload } from '@encrypt/core/crypto/commentCrypto';
import { getSenderKeyIdFromCorePayload } from '@encrypt/core/crypto/manifestDecrypt';
import type { StoredComment, StoredMessage } from '@encrypt/core/feed/types';
import type { useBackendDecrypt } from '@lab/hooks/useBackendDecrypt.ts';
import { formatCommentAuthorLabel } from '@lab/lib/formatCommentAuthorLabel.ts';
import { assembleStoredMessageCopyPayload } from '@lab/lib/assembleMessageCopyPayload.ts';
import {
  COMMENTS_PANEL_COLLAPSE_MS,
  COMMENTS_PANEL_CONTENT_GROW_MS,
} from '@lab/lib/commentsPanelTiming.ts';
import { RedactedText } from '@lab/components/RedactedText.tsx';
import { sanitizeDisplayText } from '@lab/lib/sanitizeDisplayText.ts';

type FeedContext = {
  allDeliveries: Parameters<
    ReturnType<typeof useBackendDecrypt>['decryptDelivery']
  >[0]['allDeliveries'];
  manifestLookup: Parameters<
    ReturnType<typeof useBackendDecrypt>['decryptDelivery']
  >[0]['manifestLookup'];
};

type MessageThreadCardProps = {
  message: StoredMessage;
  expanded: boolean;
  comments: StoredComment[];
  commentsLoading: boolean;
  commentsPostBusy: boolean;
  onToggleMessage: (messageId: string) => void;
  onDecryptDelivery: ReturnType<typeof useBackendDecrypt>['decryptDelivery'];
  onDecryptComments: ReturnType<typeof useBackendDecrypt>['decryptComments'];
  decryptBusy: boolean;
  decryptCommentsBusy: boolean;
  decryptError: string | null;
  decryptCommentsError: string | null;
  decryptPlaintext: string | null;
  decryptedComments: Record<string, string> | null;
  shareBusy: boolean;
  shareLastShareId: string | null;
  onOpenShare: (messageId: string) => void;
  onPostCommentForMessage: (messageId: string, text: string) => Promise<void>;
  feedContext: FeedContext;
  usernameByKeyId: Record<string, string>;
  viewerKeyId: string | null;
};

const REDACTED_PREVIEW_WORDS = 24;
const REDACTED_COMMENT_WORDS = 12;

const messageDecryptButtonSx = {
  mb: 1.25,
  py: 0.625,
  fontSize: '0.75rem',
  alignSelf: 'flex-start',
  border: 'none',
  boxShadow: 'none',
  transition: (theme: Theme) =>
    theme.transitions.create(['padding-left', 'padding-right'], {
      duration: theme.transitions.duration.short,
    }),
};

const messageEncBoxSx = (theme: {
  feedLab: { encBg: string };
  palette: { text: { secondary: string } };
}) => ({
  bgcolor: theme.feedLab.encBg,
  borderRadius: 1.5,
  px: 1.625,
  py: 1.375,
  borderLeft: `2px solid ${theme.palette.text.secondary}`,
  display: 'flex',
  flexDirection: 'column',
});

const cardActionButtonSx = {
  color: 'text.primary',
  fontWeight: 500,
  minWidth: 0,
  px: 1,
  '&:hover': {
    bgcolor: 'action.hover',
    color: 'primary.main',
  },
  '&.Mui-disabled': {
    color: 'action.disabled',
  },
};

function threadAvatarSx(isOwn: boolean, size: number) {
  return (theme: Theme) => ({
    width: size,
    height: size,
    fontSize: size >= 32 ? '0.75rem' : '0.6875rem',
    fontWeight: 700,
    flexShrink: 0,
    ...(isOwn
      ? {
          bgcolor: theme.feedLab.accentBg,
          color: 'text.primary',
          filter: 'none',
        }
      : {
          bgcolor: theme.feedLab.accentBg,
          color: 'text.primary',
          filter: 'grayscale(20%)',
        }),
  });
}

export const MessageThreadCard = memo(function MessageThreadCard({
  message,
  expanded,
  comments,
  commentsLoading,
  commentsPostBusy,
  onToggleMessage,
  onDecryptDelivery,
  onDecryptComments,
  decryptBusy,
  decryptCommentsBusy,
  decryptError,
  decryptCommentsError,
  decryptPlaintext,
  decryptedComments,
  shareBusy,
  shareLastShareId,
  onOpenShare,
  onPostCommentForMessage,
  feedContext,
  usernameByKeyId,
  viewerKeyId,
}: MessageThreadCardProps) {
  const [senderKeyId, setSenderKeyId] = useState<string | null>(null);
  const [senderLabel, setSenderLabel] = useState<string | null>(null);
  const [copyState, setCopyState] = useState<CopyState>('idle');
  const [copyBusy, setCopyBusy] = useState(false);

  const handleToggle = useCallback(() => {
    onToggleMessage(message.id);
  }, [message.id, onToggleMessage]);

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
  const sentAgo = useRelativeTime(message.createdAt);
  const sentAtLabel = useMemo(
    () => new Date(message.createdAt).toLocaleString(),
    [message.createdAt],
  );

  const handleCopy = useCallback(async () => {
    setCopyBusy(true);
    try {
      const payloadJson = assembleStoredMessageCopyPayload(
        message,
        comments,
        feedContext.allDeliveries,
      );
      await navigator.clipboard.writeText(payloadJson);
      setCopyState('ok');
    } catch {
      setCopyState('err');
    } finally {
      setCopyBusy(false);
      window.setTimeout(() => setCopyState('idle'), 2000);
    }
  }, [comments, feedContext.allDeliveries, message]);

  return (
    <Paper
      sx={{
        overflow: 'hidden',
        borderColor: expanded ? 'primary.main' : 'divider',
      }}
    >
      <Box sx={{ px: 2.125, py: 1.875 }}>
        <Stack
          direction="row"
          spacing={1.125}
          sx={{ mb: 1.5, alignItems: 'center' }}
        >
          <Avatar sx={threadAvatarSx(isOwnMessage, 32)}>
            {isOwnMessage ? 'You' : nameInitial(senderLabel ?? '?')}
          </Avatar>
          <Typography
            variant="subtitle2"
            sx={{ fontWeight: 800, fontSize: '0.8125rem' }}
            noWrap
          >
            {isOwnMessage ? 'Your own message' : (senderLabel ?? '...')}
          </Typography>
          <Box sx={{ flex: 1 }} />
          <Tooltip arrow placement="bottom-end" title={sentAtLabel}>
            <Typography
              variant="caption"
              color="text.secondary"
              component="span"
              sx={{ cursor: 'default' }}
            >
              {sentAgo}
            </Typography>
          </Tooltip>
        </Stack>

        <Box sx={messageEncBoxSx}>
          <Button
            size="small"
            variant={decryptPlaintext ? 'text' : 'contained'}
            color="primary"
            disabled={Boolean(decryptPlaintext) || decryptBusy}
            disableElevation={Boolean(decryptPlaintext)}
            startIcon={<LockOutlinedIcon sx={{ fontSize: 14 }} />}
            onClick={
              decryptPlaintext
                ? undefined
                : () => {
                    void onDecryptDelivery({
                      delivery: message,
                      allDeliveries: feedContext.allDeliveries,
                      manifestLookup: feedContext.manifestLookup,
                    });
                  }
            }
            sx={{
              ...messageDecryptButtonSx,
              pl: decryptPlaintext ? 0 : 1.5,
              pr: decryptPlaintext ? 0 : 1.5,
              ...(decryptPlaintext
                ? {
                    '&.Mui-disabled': {
                      border: 'none',
                      boxShadow: 'none',
                      color: 'primary.main',
                    },
                  }
                : null),
            }}
          >
            {decryptPlaintext ? 'Decrypted' : 'Decrypt'}
          </Button>

          {decryptPlaintext ? (
            <Typography
              variant="body2"
              sx={{
                whiteSpace: 'pre-wrap',
                lineHeight: 1.76,
                fontSize: '0.9375rem',
              }}
            >
              {sanitizeDisplayText(decryptPlaintext)}
            </Typography>
          ) : (
            <RedactedText
              seed={message.payload}
              maxPreviewWords={REDACTED_PREVIEW_WORDS}
            />
          )}
        </Box>
      </Box>

      {decryptError ? (
        <Alert severity="error" sx={{ mx: 2.125, mb: 1 }}>
          {decryptError}
        </Alert>
      ) : null}

      {copyState === 'err' ? (
        <Alert severity="error" sx={{ mx: 2.125, mb: 1 }}>
          Failed to copy message. Reload the feed and try again.
        </Alert>
      ) : null}

      <Box
        sx={{
          display: 'flex',
          alignItems: 'center',
          gap: 0.5,
          px: 1.875,
          py: 1,
          borderTop: 1,
          borderColor: 'divider',
        }}
      >
        <Button
          size="small"
          color="inherit"
          onClick={handleToggle}
          startIcon={<ChatBubbleOutlineOutlinedIcon sx={{ fontSize: 16 }} />}
          sx={cardActionButtonSx}
        >
          Comments
        </Button>
        <Button
          size="small"
          color="inherit"
          disabled={copyBusy}
          onClick={() => void handleCopy()}
          startIcon={
            copyState === 'ok' ? (
              <CheckIcon sx={{ fontSize: 16 }} />
            ) : (
              <ContentCopyOutlinedIcon sx={{ fontSize: 16 }} />
            )
          }
          sx={{
            ...cardActionButtonSx,
            ...(copyState === 'ok'
              ? {
                  color: 'success.main',
                  '&:hover': { color: 'success.dark' },
                }
              : null),
          }}
        >
          Copy
        </Button>
        <Button
          size="small"
          color="inherit"
          disabled={shareBusy}
          onClick={() => onOpenShare(message.id)}
          startIcon={<ShareOutlinedIcon sx={{ fontSize: 16 }} />}
          sx={cardActionButtonSx}
        >
          Share
        </Button>
      </Box>

      <Collapse
        in={expanded}
        timeout={COMMENTS_PANEL_COLLAPSE_MS}
        unmountOnExit
      >
        <MessageThreadExpandedPanel
          message={message}
          comments={comments}
          commentsLoading={commentsLoading}
          commentsPostBusy={commentsPostBusy}
          decryptCommentsError={decryptCommentsError}
          decryptPlaintext={decryptPlaintext}
          decryptedComments={decryptedComments}
          decryptCommentsBusy={decryptCommentsBusy}
          onDecryptComments={onDecryptComments}
          feedContext={feedContext}
          shareLastShareId={shareLastShareId}
          onPostCommentForMessage={onPostCommentForMessage}
          usernameByKeyId={usernameByKeyId}
          viewerKeyId={viewerKeyId}
        />
      </Collapse>
    </Paper>
  );
});

type MessageThreadExpandedPanelProps = {
  message: StoredMessage;
  comments: StoredComment[];
  commentsLoading: boolean;
  commentsPostBusy: boolean;
  decryptCommentsError: string | null;
  decryptPlaintext: string | null;
  decryptedComments: Record<string, string> | null;
  decryptCommentsBusy: boolean;
  onDecryptComments: ReturnType<typeof useBackendDecrypt>['decryptComments'];
  feedContext: FeedContext;
  shareLastShareId: string | null;
  onPostCommentForMessage: (messageId: string, text: string) => Promise<void>;
  usernameByKeyId: Record<string, string>;
  viewerKeyId: string | null;
};

const MessageThreadExpandedPanel = memo(function MessageThreadExpandedPanel({
  message,
  comments,
  commentsLoading,
  commentsPostBusy,
  decryptCommentsError,
  decryptPlaintext,
  decryptedComments,
  decryptCommentsBusy,
  onDecryptComments,
  feedContext,
  shareLastShareId,
  onPostCommentForMessage,
  usernameByKeyId,
  viewerKeyId,
}: MessageThreadExpandedPanelProps) {
  const commentsDecrypted = decryptedComments !== null;
  const showDecryptCommentsButton =
    !commentsLoading && comments.length > 0 && !commentsDecrypted;

  return (
    <Box
      onClick={(event) => event.stopPropagation()}
      sx={{ px: 2.125, pb: 2, borderTop: 1, borderColor: 'divider' }}
    >
      {shareLastShareId ? (
        <Alert severity="success" sx={{ mt: 1.5 }}>
          Share created: {shareLastShareId}
        </Alert>
      ) : null}

      <Stack
        direction="row"
        spacing={1}
        sx={{ mt: 2, mb: 1.5, alignItems: 'center' }}
      >
        <Typography variant="subtitle2" sx={{ flex: 1 }}>
          {commentsLoading ? 'Comments' : `Comments (${comments.length})`}
        </Typography>
        {showDecryptCommentsButton ? (
          <Button
            size="small"
            variant="contained"
            color="primary"
            disabled={decryptCommentsBusy}
            startIcon={<LockOutlinedIcon sx={{ fontSize: 14 }} />}
            onClick={() => {
              void onDecryptComments({
                messageId: message.id,
                comments,
                allDeliveries: feedContext.allDeliveries,
                manifestLookup: feedContext.manifestLookup,
              });
            }}
            sx={{ py: 0.625, px: 1.5, fontSize: '0.75rem' }}
          >
            {decryptCommentsBusy ? 'Decrypting…' : 'Decrypt comments'}
          </Button>
        ) : null}
      </Stack>

      {decryptCommentsError ? (
        <Alert severity="error" sx={{ mb: 1.5 }}>
          {decryptCommentsError}
        </Alert>
      ) : null}

      <Box>
        {commentsLoading ? (
          <Stack
            direction="row"
            spacing={1}
            sx={{ alignItems: 'center', py: 0.5 }}
          >
            <CircularProgress size={16} />
            <Typography variant="body2" color="text.secondary">
              Loading comments…
            </Typography>
          </Stack>
        ) : null}

        <Collapse
          in={!commentsLoading}
          timeout={COMMENTS_PANEL_CONTENT_GROW_MS}
        >
          <Box>
            {comments.length > 0 ? (
              <Stack spacing={1}>
                {comments.map((comment) => {
                  const text =
                    decryptedComments !== null
                      ? decryptedComments[comment.id]
                      : null;

                  return (
                    <CommentRow
                      key={comment.id}
                      comment={comment}
                      text={text}
                      usernameByKeyId={usernameByKeyId}
                      viewerKeyId={viewerKeyId}
                    />
                  );
                })}
                {decryptedComments !== null &&
                Object.keys(decryptedComments).length === 0 ? (
                  <Typography variant="body2" color="text.secondary">
                    Could not decrypt comments.
                  </Typography>
                ) : null}
              </Stack>
            ) : (
              <Typography variant="body2" color="text.secondary">
                No comments yet.
              </Typography>
            )}
          </Box>
        </Collapse>
      </Box>

      <CommentComposer
        commentsPostBusy={commentsPostBusy}
        messageDecrypted={decryptPlaintext !== null}
        onPostCommentForMessage={onPostCommentForMessage}
        messageId={message.id}
      />
    </Box>
  );
});

const CommentComposer = memo(function CommentComposer({
  messageId,
  commentsPostBusy,
  messageDecrypted,
  onPostCommentForMessage,
}: {
  messageId: string;
  commentsPostBusy: boolean;
  messageDecrypted: boolean;
  onPostCommentForMessage: (messageId: string, text: string) => Promise<void>;
}) {
  const [commentText, setCommentText] = useState('');

  const handlePostComment = useCallback(async () => {
    const text = commentText.trim();
    if (!text) {
      return;
    }
    await onPostCommentForMessage(messageId, text);
    setCommentText('');
  }, [commentText, messageId, onPostCommentForMessage]);

  return (
    <>
      <TextField
        fullWidth
        multiline
        minRows={3}
        label="New comment"
        value={commentText}
        onChange={(event) => setCommentText(event.target.value)}
        disabled={!messageDecrypted || commentsPostBusy}
        helperText={
          messageDecrypted ? undefined : 'Decrypt the message to add a comment.'
        }
        sx={{ my: 2 }}
      />
      <Button
        variant="contained"
        size="small"
        disabled={!messageDecrypted || commentsPostBusy || !commentText.trim()}
        onClick={() => void handlePostComment()}
      >
        {commentsPostBusy ? 'Posting…' : 'Add comment'}
      </Button>
    </>
  );
});

const CommentRow = memo(function CommentRow({
  comment,
  text,
  usernameByKeyId,
  viewerKeyId,
}: {
  comment: StoredComment;
  text: string | null;
  usernameByKeyId: Record<string, string>;
  viewerKeyId: string | null;
}) {
  const [authorKeyId, setAuthorKeyId] = useState<string | null>(null);
  const [authorLabel, setAuthorLabel] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;

    void getCommentAuthorKeyIdFromPayload(comment.payload).then(
      (resolvedAuthorKeyId) => {
        if (!cancelled) {
          setAuthorKeyId(resolvedAuthorKeyId);
          setAuthorLabel(
            formatCommentAuthorLabel(resolvedAuthorKeyId, usernameByKeyId),
          );
        }
      },
    );

    return () => {
      cancelled = true;
    };
  }, [comment.payload, usernameByKeyId]);

  const isOwnComment =
    viewerKeyId !== null && authorKeyId !== null && authorKeyId === viewerKeyId;

  return (
    <Box
      sx={(theme) => ({
        borderRadius: 1.5,
        px: 1.625,
        py: 1.375,
        bgcolor: theme.feedLab.encBg,
        borderLeft: `2px solid ${theme.palette.text.secondary}`,
      })}
    >
      <Stack spacing={0.75}>
        <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
          <Avatar sx={threadAvatarSx(isOwnComment, 32)}>
            {isOwnComment ? 'You' : nameInitial(authorLabel ?? '?')}
          </Avatar>
          <Typography variant="caption" sx={{ fontWeight: 600 }}>
            {isOwnComment ? 'Your own comment' : (authorLabel ?? '...')}
          </Typography>
        </Box>
        {text ? (
          <Typography variant="body2" sx={{ whiteSpace: 'pre-wrap' }}>
            {sanitizeDisplayText(text)}
          </Typography>
        ) : (
          <RedactedText
            seed={comment.payload}
            maxPreviewWords={REDACTED_COMMENT_WORDS}
          />
        )}
      </Stack>
    </Box>
  );
});
