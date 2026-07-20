import React, {
  memo,
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
} from 'react';
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
import { resolveParentMessageAccessFromFeed } from '@encrypt/core/feed/access';
import type { StoredComment, StoredMessage } from '@encrypt/core/feed/types';
import type { useBackendDecrypt } from '@lab/hooks/useBackendDecrypt.ts';
import { useBackendComments } from '@lab/hooks/useBackendComments.ts';
import type { IdentityDialogTarget } from '@lab/components/IdentityDialog.tsx';
import { formatCommentAuthorLabel } from '@lab/lib/formatCommentAuthorLabel.ts';
import { assembleStoredMessageCopyPayload } from '@lab/lib/assembleMessageCopyPayload.ts';
import {
  COMMENTS_PANEL_COLLAPSE_MS,
  COMMENTS_PANEL_CONTENT_GROW_MS,
} from '@lab/lib/commentsPanelTiming.ts';
import {
  getCommentAuthorIdentityFromPayload,
  getSenderIdentityFromCorePayload,
  getSharerIdentityFromSharePayload,
  type FeedIdentity,
} from '@lab/lib/identityFromPayload.ts';
import { RedactedText } from '@lab/components/RedactedText.tsx';
import { sanitizeDisplayText } from '@lab/lib/sanitizeDisplayText.ts';
import { useFeedLabSession } from '@lab/providers/FeedLabSessionProvider.tsx';
import {
  encryptedContentCiphertextBase64Length,
  MAX_CONTENT_CIPHERTEXT_BASE64_LENGTH,
  validateContentPlaintext,
} from '@encrypt/core/constants/contentLimits';

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
  highlighted: boolean;
  onMessageInteract: (messageId: string) => void;
  onToggleMessage: (messageId: string) => void;
  onDecryptDelivery: ReturnType<typeof useBackendDecrypt>['decryptDelivery'];
  onDecryptComments: ReturnType<typeof useBackendDecrypt>['decryptComments'];
  decryptBusy: boolean;
  decryptError: string | null;
  decryptCommentsError: string | null;
  decryptPlaintext: string | null;
  decryptedComments: Record<string, string> | null;
  shareBusy: boolean;
  shareLastShareId: string | null;
  onOpenShare: (messageId: string) => void;
  onMergeDecryptedComments: ReturnType<
    typeof useBackendDecrypt
  >['mergeDecryptedComments'];
  feedContext: FeedContext;
  usernameByKeyId: Record<string, string>;
  viewerKeyId: string | null;
  onOpenIdentity: (identity: IdentityDialogTarget) => void;
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

const ENC_PAPER_ELEVATION = 3;

const encPaperSx = (theme: Theme) => ({
  bgcolor: theme.feedLab.encBg,
  borderRadius: 1.5,
  border: 'none',
  boxShadow: theme.shadows[ENC_PAPER_ELEVATION],
  px: 1.625,
  py: 1.375,
  display: 'flex',
  flexDirection: 'column',
  overflow: 'hidden',
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

const identityButtonSx = {
  display: 'inline-flex',
  alignItems: 'center',
  gap: 1.125,
  minWidth: 0,
  p: 0,
  m: 0,
  border: 'none',
  background: 'none',
  cursor: 'pointer',
  color: 'inherit',
  textAlign: 'left' as const,
  borderRadius: 1,
  '&:hover': {
    opacity: 0.85,
  },
  '&:disabled': {
    cursor: 'default',
    opacity: 1,
  },
};

export const MessageThreadCard = memo(function MessageThreadCard({
  message,
  expanded,
  highlighted,
  onMessageInteract,
  onToggleMessage,
  onDecryptDelivery,
  onDecryptComments,
  decryptBusy,
  decryptError,
  decryptCommentsError,
  decryptPlaintext,
  decryptedComments,
  shareBusy,
  shareLastShareId,
  onOpenShare,
  onMergeDecryptedComments,
  feedContext,
  usernameByKeyId,
  viewerKeyId,
  onOpenIdentity,
}: MessageThreadCardProps) {
  const [senderIdentity, setSenderIdentity] = useState<FeedIdentity | null>(
    null,
  );
  const [senderLabel, setSenderLabel] = useState<string | null>(null);
  const [sharerIdentity, setSharerIdentity] = useState<FeedIdentity | null>(
    null,
  );
  const [sharerLabel, setSharerLabel] = useState<string | null>(null);
  const [copyState, setCopyState] = useState<CopyState>('idle');
  const [copyBusy, setCopyBusy] = useState(false);
  const [commentsForCopy, setCommentsForCopy] = useState<StoredComment[]>([]);

  const markInteracted = useCallback(() => {
    onMessageInteract(message.id);
  }, [message.id, onMessageInteract]);

  const handleToggle = useCallback(() => {
    onToggleMessage(message.id);
  }, [message.id, onToggleMessage]);

  useEffect(() => {
    if (!expanded) {
      setCommentsForCopy([]);
    }
  }, [expanded]);

  useEffect(() => {
    let cancelled = false;

    void getSenderIdentityFromCorePayload(message.payload).then((identity) => {
      if (!cancelled) {
        setSenderIdentity(identity);
        setSenderLabel(
          identity
            ? formatCommentAuthorLabel(identity.keyId, usernameByKeyId)
            : null,
        );
      }
    });

    return () => {
      cancelled = true;
    };
  }, [message.payload, usernameByKeyId]);

  useEffect(() => {
    let cancelled = false;

    if (!viewerKeyId) {
      setSharerIdentity(null);
      setSharerLabel(null);
      return;
    }

    void (async () => {
      const access = await resolveParentMessageAccessFromFeed(
        message.id,
        viewerKeyId,
        feedContext.allDeliveries,
        feedContext.manifestLookup,
      );
      if (cancelled) {
        return;
      }
      if (!access || access.deliveryMessageId === message.id) {
        setSharerIdentity(null);
        setSharerLabel(null);
        return;
      }

      const identity = await getSharerIdentityFromSharePayload(
        access.deliveryCorePayloadJson,
      );
      if (cancelled) {
        return;
      }
      setSharerIdentity(identity);
      setSharerLabel(
        identity
          ? formatCommentAuthorLabel(identity.keyId, usernameByKeyId)
          : null,
      );
    })();

    return () => {
      cancelled = true;
    };
  }, [
    feedContext.allDeliveries,
    feedContext.manifestLookup,
    message.id,
    usernameByKeyId,
    viewerKeyId,
  ]);

  const senderKeyId = senderIdentity?.keyId ?? null;
  const isOwnMessage =
    viewerKeyId !== null && senderKeyId !== null && senderKeyId === viewerKeyId;

  const handleOpenSenderIdentity = useCallback(() => {
    if (!senderIdentity) {
      return;
    }
    markInteracted();
    onOpenIdentity({
      keyId: senderIdentity.keyId,
      publicKey: senderIdentity.publicKey,
      label: senderLabel ?? senderIdentity.keyId,
    });
  }, [markInteracted, onOpenIdentity, senderIdentity, senderLabel]);

  const handleOpenSharerIdentity = useCallback(() => {
    if (!sharerIdentity) {
      return;
    }
    markInteracted();
    onOpenIdentity({
      keyId: sharerIdentity.keyId,
      publicKey: sharerIdentity.publicKey,
      label: sharerLabel ?? sharerIdentity.keyId,
    });
  }, [markInteracted, onOpenIdentity, sharerIdentity, sharerLabel]);

  const sentAgo = useRelativeTime(message.createdAt);
  const sentAtLabel = useMemo(
    () => new Date(message.createdAt).toLocaleString(),
    [message.createdAt],
  );

  const handleCopy = useCallback(async () => {
    markInteracted();
    setCopyBusy(true);
    try {
      const payloadJson = assembleStoredMessageCopyPayload(
        message,
        commentsForCopy,
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
  }, [commentsForCopy, feedContext.allDeliveries, markInteracted, message]);

  return (
    <Paper
      sx={{
        overflow: 'hidden',
        borderColor: highlighted ? 'primary.main' : 'divider',
      }}
    >
      <Box sx={{ px: 2, py: 2 }}>
        <Stack
          direction="row"
          spacing={1}
          sx={{ mb: 1.5, alignItems: 'center' }}
        >
          <Stack
            direction="row"
            spacing={1}
            sx={{ alignItems: 'center', flex: 1, minWidth: 0 }}
          >
            <Box
              component="button"
              type="button"
              disabled={!senderIdentity}
              onClick={handleOpenSenderIdentity}
              sx={{
                ...identityButtonSx,
                gap: 0,
                flexShrink: 0,
              }}
              aria-label={
                isOwnMessage
                  ? 'View your identity'
                  : `View identity for ${senderLabel ?? 'sender'}`
              }
            >
              <Avatar sx={threadAvatarSx(isOwnMessage, 32)}>
                {isOwnMessage ? 'You' : nameInitial(senderLabel ?? '?')}
              </Avatar>
            </Box>
            <Stack spacing={0.2} sx={{ minWidth: 0 }}>
              <Typography
                component="button"
                type="button"
                disabled={!senderIdentity}
                onClick={handleOpenSenderIdentity}
                variant="subtitle2"
                sx={{
                  p: 0,
                  border: 'none',
                  background: 'none',
                  cursor: senderIdentity ? 'pointer' : 'default',
                  color: 'inherit',
                  fontWeight: 800,
                  fontSize: '0.8125rem',
                  textAlign: 'left',
                  maxWidth: '100%',
                  overflow: 'hidden',
                  textOverflow: 'ellipsis',
                  whiteSpace: 'nowrap',
                  '&:hover': senderIdentity ? { opacity: 0.85 } : undefined,
                }}
              >
                {isOwnMessage ? 'Your own message' : (senderLabel ?? '...')}
              </Typography>
              {sharerIdentity && sharerLabel ? (
                <Typography
                  component="button"
                  type="button"
                  variant="caption"
                  color="primary"
                  onClick={handleOpenSharerIdentity}
                  sx={{
                    p: 0,
                    border: 'none',
                    background: 'none',
                    cursor: 'pointer',
                    textAlign: 'left',
                    maxWidth: '100%',
                    overflow: 'hidden',
                    textOverflow: 'ellipsis',
                    whiteSpace: 'nowrap',
                    '&:hover': { color: 'text.primary' },
                  }}
                >
                  shared by: {sharerLabel}
                </Typography>
              ) : null}
            </Stack>
          </Stack>
          <Tooltip arrow placement="bottom-end" title={sentAtLabel}>
            <Typography
              variant="caption"
              color="text.secondary"
              component="span"
              sx={{ cursor: 'default', flexShrink: 0 }}
            >
              {sentAgo}
            </Typography>
          </Tooltip>
        </Stack>

        <Paper elevation={ENC_PAPER_ELEVATION} sx={encPaperSx}>
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
                    markInteracted();
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
              sx={{ whiteSpace: 'pre-wrap', overflowWrap: 'anywhere' }}
            >
              {sanitizeDisplayText(decryptPlaintext)}
            </Typography>
          ) : (
            <RedactedText
              seed={message.payload}
              maxPreviewWords={REDACTED_PREVIEW_WORDS}
            />
          )}
        </Paper>
      </Box>

      {decryptError ? (
        <Alert severity="error" sx={{ mx: 2, mb: 1 }}>
          {decryptError}
        </Alert>
      ) : null}

      {copyState === 'err' ? (
        <Alert severity="error" sx={{ mx: 2, mb: 1 }}>
          Failed to copy message. Reload the feed and try again.
        </Alert>
      ) : null}

      <Box
        sx={{
          display: 'flex',
          alignItems: 'center',
          gap: 0.5,
          px: 2,
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
          decryptCommentsError={decryptCommentsError}
          decryptPlaintext={decryptPlaintext}
          decryptedComments={decryptedComments}
          onDecryptComments={onDecryptComments}
          onMergeDecryptedComments={onMergeDecryptedComments}
          onMessageInteract={onMessageInteract}
          feedContext={feedContext}
          shareLastShareId={shareLastShareId}
          onCommentsForCopyChange={setCommentsForCopy}
          usernameByKeyId={usernameByKeyId}
          viewerKeyId={viewerKeyId}
          onOpenIdentity={onOpenIdentity}
        />
      </Collapse>
    </Paper>
  );
});

type MessageThreadExpandedPanelProps = {
  message: StoredMessage;
  decryptCommentsError: string | null;
  decryptPlaintext: string | null;
  decryptedComments: Record<string, string> | null;
  onDecryptComments: ReturnType<typeof useBackendDecrypt>['decryptComments'];
  onMergeDecryptedComments: ReturnType<
    typeof useBackendDecrypt
  >['mergeDecryptedComments'];
  onMessageInteract: (messageId: string) => void;
  feedContext: FeedContext;
  shareLastShareId: string | null;
  onCommentsForCopyChange: (comments: StoredComment[]) => void;
  usernameByKeyId: Record<string, string>;
  viewerKeyId: string | null;
  onOpenIdentity: (identity: IdentityDialogTarget) => void;
};

const MessageThreadExpandedPanel = memo(function MessageThreadExpandedPanel({
  message,
  decryptCommentsError,
  decryptPlaintext,
  decryptedComments,
  onDecryptComments,
  onMergeDecryptedComments,
  onMessageInteract,
  feedContext,
  shareLastShareId,
  onCommentsForCopyChange,
  usernameByKeyId,
  viewerKeyId,
  onOpenIdentity,
}: MessageThreadExpandedPanelProps) {
  const { keys } = useFeedLabSession();
  const {
    comments,
    loading: commentsLoading,
    postBusy: commentsPostBusy,
    postComment,
    decryptCommentText,
  } = useBackendComments(message.id, keys.keyId, keys.withPrivateKey);

  useEffect(() => {
    if (!commentsLoading) {
      onCommentsForCopyChange(comments);
    }
  }, [comments, commentsLoading, onCommentsForCopyChange]);

  const autoDecryptCommentsAttemptedRef = useRef(false);
  useEffect(() => {
    if (!decryptPlaintext) {
      autoDecryptCommentsAttemptedRef.current = false;
      return;
    }
    if (
      commentsLoading ||
      decryptedComments !== null ||
      comments.length === 0 ||
      autoDecryptCommentsAttemptedRef.current
    ) {
      return;
    }
    // Retry if message decrypt's comment fetch failed and comments are available here.
    autoDecryptCommentsAttemptedRef.current = true;
    void onDecryptComments({
      messageId: message.id,
      comments,
      allDeliveries: feedContext.allDeliveries,
      manifestLookup: feedContext.manifestLookup,
    });
  }, [
    comments,
    commentsLoading,
    decryptPlaintext,
    decryptedComments,
    feedContext.allDeliveries,
    feedContext.manifestLookup,
    message.id,
    onDecryptComments,
  ]);

  const handlePostComment = useCallback(
    async (text: string) => {
      onMessageInteract(message.id);
      const newComment = await postComment({
        messageId: message.id,
        allDeliveries: feedContext.allDeliveries,
        manifestLookup: feedContext.manifestLookup,
        text,
      });
      if (!newComment) {
        return;
      }

      const decryptedText = await decryptCommentText(newComment, {
        allDeliveries: feedContext.allDeliveries,
        manifestLookup: feedContext.manifestLookup,
      });
      if (decryptedText) {
        onMergeDecryptedComments(message.id, {
          [newComment.id]: decryptedText,
        });
      }
    },
    [
      decryptCommentText,
      feedContext.allDeliveries,
      feedContext.manifestLookup,
      message.id,
      onMergeDecryptedComments,
      onMessageInteract,
      postComment,
    ],
  );

  return (
    <Box
      onClick={(event) => event.stopPropagation()}
      sx={{
        px: 3,
        pt: 1.5,
        pb: 2,
        borderTop: 1,
        borderColor: 'divider',
        display: 'flex',
        flexDirection: 'column',
        gap: 0.5,
      }}
    >
      {shareLastShareId ? (
        <Alert severity="success" sx={{ mt: 1.5 }}>
          Share created: {shareLastShareId}
        </Alert>
      ) : null}

      <Typography
        variant="subtitle2"
        sx={{
          display: 'flex',
          alignItems: 'center',
          fontSize: '0.75rem',
        }}
      >
        Comments (
        {commentsLoading ? <CircularProgress size={10} /> : comments.length})
      </Typography>

      {decryptCommentsError ? (
        <Alert severity="error" sx={{ mb: 1.5 }}>
          {decryptCommentsError}
        </Alert>
      ) : null}

      {comments.length > 0 && !commentsLoading ? (
        <Collapse in appear timeout={COMMENTS_PANEL_CONTENT_GROW_MS}>
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
                  onOpenIdentity={onOpenIdentity}
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
        </Collapse>
      ) : null}

      <CommentComposer
        commentsPostBusy={commentsPostBusy}
        messageDecrypted={decryptPlaintext !== null}
        onPostComment={handlePostComment}
      />
    </Box>
  );
});

const CommentComposer = memo(function CommentComposer({
  commentsPostBusy,
  messageDecrypted,
  onPostComment,
}: {
  commentsPostBusy: boolean;
  messageDecrypted: boolean;
  onPostComment: (text: string) => Promise<void>;
}) {
  const [commentText, setCommentText] = useState('');

  const commentCiphertextLength = commentText
    ? encryptedContentCiphertextBase64Length(commentText)
    : 0;
  const commentOverLimit =
    commentCiphertextLength > MAX_CONTENT_CIPHERTEXT_BASE64_LENGTH;

  const handlePostComment = useCallback(async () => {
    if (validateContentPlaintext(commentText, 'comment')) {
      return;
    }
    await onPostComment(commentText.trim());
    setCommentText('');
  }, [commentText, onPostComment]);

  return (
    <>
      <TextField
        fullWidth
        multiline
        minRows={2}
        value={commentText}
        onChange={(event) => setCommentText(event.target.value)}
        disabled={!messageDecrypted || commentsPostBusy}
        placeholder={
          messageDecrypted ? 'New comment' : 'Decrypt message to add a comment'
        }
        sx={{ mt: 1 }}
        error={commentOverLimit}
        slotProps={{
          input: {
            sx: {
              fontSize: '0.875rem',
            },
          },
        }}
        helperText={`${commentCiphertextLength}/${MAX_CONTENT_CIPHERTEXT_BASE64_LENGTH} encrypted size`}
      />
      <Button
        variant="contained"
        size="small"
        disabled={
          !messageDecrypted ||
          commentsPostBusy ||
          !commentText.trim() ||
          commentOverLimit
        }
        onClick={() => void handlePostComment()}
        sx={{ width: 'fit-content' }}
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
  onOpenIdentity,
}: {
  comment: StoredComment;
  text: string | null;
  usernameByKeyId: Record<string, string>;
  viewerKeyId: string | null;
  onOpenIdentity: (identity: IdentityDialogTarget) => void;
}) {
  const [authorIdentity, setAuthorIdentity] = useState<FeedIdentity | null>(
    null,
  );
  const [authorLabel, setAuthorLabel] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;

    void getCommentAuthorIdentityFromPayload(comment.payload).then(
      (identity) => {
        if (!cancelled) {
          setAuthorIdentity(identity);
          setAuthorLabel(
            identity
              ? formatCommentAuthorLabel(identity.keyId, usernameByKeyId)
              : null,
          );
        }
      },
    );

    return () => {
      cancelled = true;
    };
  }, [comment.payload, usernameByKeyId]);

  const authorKeyId = authorIdentity?.keyId ?? null;
  const isOwnComment =
    viewerKeyId !== null && authorKeyId !== null && authorKeyId === viewerKeyId;

  const handleOpenAuthorIdentity = useCallback(() => {
    if (!authorIdentity) {
      return;
    }
    onOpenIdentity({
      keyId: authorIdentity.keyId,
      publicKey: authorIdentity.publicKey,
      label: authorLabel ?? authorIdentity.keyId,
    });
  }, [authorIdentity, authorLabel, onOpenIdentity]);

  return (
    <Paper elevation={ENC_PAPER_ELEVATION} sx={encPaperSx}>
      <Stack spacing={0.75}>
        <Box
          component="button"
          type="button"
          disabled={!authorIdentity}
          onClick={handleOpenAuthorIdentity}
          sx={{ ...identityButtonSx, gap: 1 }}
          aria-label={
            isOwnComment
              ? 'View your identity'
              : `View identity for ${authorLabel ?? 'author'}`
          }
        >
          <Avatar sx={threadAvatarSx(isOwnComment, 28)}>
            {isOwnComment ? 'You' : nameInitial(authorLabel ?? '?')}
          </Avatar>
          <Typography variant="caption">
            {isOwnComment ? 'Your own comment' : (authorLabel ?? '...')}
          </Typography>
        </Box>
        {text ? (
          <Typography
            variant="body2"
            sx={{ whiteSpace: 'pre-wrap', overflowWrap: 'anywhere' }}
          >
            {sanitizeDisplayText(text)}
          </Typography>
        ) : (
          <RedactedText
            seed={comment.payload}
            maxPreviewWords={REDACTED_COMMENT_WORDS}
          />
        )}
      </Stack>
    </Paper>
  );
});
