import React, { memo, useCallback, useMemo, useState } from 'react';
import Avatar from '@mui/material/Avatar';
import Box from '@mui/material/Box';
import Button from '@mui/material/Button';
import Card from '@mui/material/Card';
import CardActions from '@mui/material/CardActions';
import CardContent from '@mui/material/CardContent';
import CircularProgress from '@mui/material/CircularProgress';
import Stack from '@mui/material/Stack';
import Typography from '@mui/material/Typography';
import ChatBubbleOutlineOutlinedIcon from '@mui/icons-material/ChatBubbleOutlineOutlined';
import FavoriteBorderOutlinedIcon from '@mui/icons-material/FavoriteBorderOutlined';
import LockOpenIcon from '@mui/icons-material/LockOpen';
import ShareOutlinedIcon from '@mui/icons-material/ShareOutlined';
import {
  decryptCommentsWithUploadedPrivateKey,
  decryptMessagesAndCommentsWithUploadedPrivateKey,
  decryptStoredMessageAndCommentsWithUploadedPrivateKey,
  listDecryptableCommentsForMessage,
  type MessageDecryptionResult,
} from '@/crypto/messageDecrypt.ts';
import { isPrivateKeyFileSelectionCancelled } from '@/crypto/privateKeyFile.ts';
import { errorMessage } from '@/utils/errorMessage.ts';
import type { InboxMessage } from '@/hooks/useInboxMessages.ts';
import { useInboxSenderLabels } from '@/hooks/useInboxSenderLabels.ts';
import { useRelativeTime } from '@/hooks/useRelativeTime.ts';
import { nameInitial } from '@/utils/nameInitial.ts';
import { MessageCommentsPanel } from '@/components/inbox/MessageCommentsPanel.tsx';
import { ShareMessageDialog } from '@/components/inbox/ShareMessageDialog.tsx';
import { useMessageCommentCounts } from '@/hooks/useMessageCommentCounts.ts';
import { getCommentThreadMessageId } from '@/crypto/manifestShare.ts';
import type { StoredMessage } from '@/crypto/storedMessages.ts';
import Divider from '@mui/material/Divider';

function commentButtonLabel(count: number): string {
  return count > 0 ? `Comment (${count})` : 'Comment';
}

const MESSAGE_POP_IN = 'messagePopIn';

function MessageInboxItemPopIn({
  messageId,
  animateEntry,
  onAnimationDone,
  children,
}: {
  messageId: string;
  animateEntry: boolean;
  onAnimationDone: (messageId: string) => void;
  children: React.ReactNode;
}) {
  const [shouldAnimate] = useState(animateEntry);

  const handleAnimationEnd = useCallback(
    (event: React.AnimationEvent<HTMLDivElement>) => {
      if (event.animationName !== MESSAGE_POP_IN) {
        return;
      }
      onAnimationDone(messageId);
    },
    [messageId, onAnimationDone],
  );

  return (
    <Box
      onAnimationEnd={handleAnimationEnd}
      sx={{
        [`@keyframes ${MESSAGE_POP_IN}`]: {
          from: {
            opacity: 0,
            transform: 'translateY(-24px) scale(0.96)',
          },
          to: {
            opacity: 1,
            transform: 'translateY(0) scale(1)',
          },
        },
        animation: shouldAnimate
          ? `${MESSAGE_POP_IN} 0.4s ease-out both`
          : 'none',
      }}
    >
      {children}
    </Box>
  );
}

type MessageInboxProps = {
  messages: InboxMessage[];
  loading: boolean;
  error: string | null;
  recipientKeyId: string | null;
  onShareCreated?: (shareDelivery: StoredMessage) => void;
};

const MessageInboxItem = memo(function MessageInboxItem({
  message,
  senderLabel,
  decryption,
  decrypting,
  decryptDisabled,
  onDecrypt,
  recipientKeyId,
  commentCount,
  onCommentPosted,
  commentDecryptionById,
  decryptingCommentId,
  onDecryptComment,
  onShare,
}: {
  message: InboxMessage;
  senderLabel: string;
  decryption: MessageDecryptionResult;
  decrypting: boolean;
  decryptDisabled: boolean;
  onDecrypt: () => void;
  recipientKeyId: string;
  commentCount: number;
  onCommentPosted: () => void;
  commentDecryptionById: Record<string, MessageDecryptionResult>;
  decryptingCommentId: string | null;
  onDecryptComment: (commentId: string) => void;
  onShare: () => void;
}) {
  const [commentsOpen, setCommentsOpen] = useState(false);
  const { text: decryptedText, error: decryptError } = decryption;
  const sentAgo = useRelativeTime(message.createdAt);
  const commentThreadId = getCommentThreadMessageId(message);

  return (
    <Card>
      <CardContent sx={{ pb: 1 }}>
        <Stack spacing={1.5}>
          <Box sx={{ display: 'flex', gap: 1.5, alignItems: 'flex-start' }}>
            <Avatar sx={{ width: 40, height: 40, fontWeight: 600 }}>
              {nameInitial(senderLabel)}
            </Avatar>
            <Box sx={{ minWidth: 0, pt: 0.25 }}>
              <Typography variant="subtitle2" noWrap>
                {senderLabel}
              </Typography>
              <Typography variant="caption" color="text.secondary">
                {sentAgo}
              </Typography>
            </Box>
          </Box>

          {decryptError && (
            <Typography color="error" variant="body2">
              {decryptError}
            </Typography>
          )}

          <Typography
            variant="body2"
            sx={{
              whiteSpace: 'pre-wrap',
              color: decryptedText !== null ? 'text.primary' : 'text.secondary',
              fontStyle: decryptedText !== null ? 'normal' : 'italic',
            }}
          >
            {decryptedText ?? 'Encrypted message — decrypt to read.'}
          </Typography>
        </Stack>
      </CardContent>

      <CardActions sx={{ px: 2, pb: 2, pt: 0, gap: 1, flexWrap: 'wrap' }}>
        <Button
          size="small"
          variant="outlined"
          onClick={onDecrypt}
          disabled={decryptDisabled}
          startIcon={<LockOpenIcon />}
        >
          {decrypting ? 'Decrypting…' : 'Decrypt'}
        </Button>
        <Button
          size="small"
          variant="outlined"
          onClick={onShare}
          startIcon={<ShareOutlinedIcon />}
        >
          Share
        </Button>
        <Button
          size="small"
          variant="outlined"
          disabled
          startIcon={<FavoriteBorderOutlinedIcon />}
        >
          Like
        </Button>
        <Button
          size="small"
          variant="outlined"
          onClick={() => setCommentsOpen(true)}
          startIcon={<ChatBubbleOutlineOutlinedIcon />}
        >
          {commentButtonLabel(commentCount)}
        </Button>
      </CardActions>

      {commentsOpen && (
        <Box sx={{ px: 2, pb: 2 }}>
          <Divider>
            <Typography variant="caption">Comments</Typography>
          </Divider>
          <MessageCommentsPanel
            messageId={commentThreadId}
            recipientKeyId={recipientKeyId}
            commentDecryptionById={commentDecryptionById}
            decryptingCommentId={decryptingCommentId}
            onDecryptComment={onDecryptComment}
            onCommentPosted={onCommentPosted}
            onClose={() => setCommentsOpen(false)}
          />
        </Box>
      )}
    </Card>
  );
});

export function MessageInbox({
  messages,
  loading,
  error,
  recipientKeyId,
  onShareCreated,
}: MessageInboxProps) {
  const [knownMessageIds, setKnownMessageIds] = useState<Set<string>>(
    () => new Set(),
  );
  const [initialLoadDone, setInitialLoadDone] = useState(false);
  const [prevLoading, setPrevLoading] = useState(loading);
  const [decryptionById, setDecryptionById] = useState<
    Record<string, MessageDecryptionResult>
  >({});
  const [commentDecryptionByMessageId, setCommentDecryptionByMessageId] =
    useState<Record<string, Record<string, MessageDecryptionResult>>>({});
  const [decryptingCommentId, setDecryptingCommentId] = useState<string | null>(
    null,
  );
  const [decryptingMessageId, setDecryptingMessageId] = useState<string | null>(
    null,
  );
  const [bulkDecrypting, setBulkDecrypting] = useState(false);
  const [bulkDecryptError, setBulkDecryptError] = useState<string | null>(null);
  const [shareSourceMessage, setShareSourceMessage] =
    useState<StoredMessage | null>(null);

  if (loading !== prevLoading) {
    setPrevLoading(loading);
    if (loading) {
      setKnownMessageIds(new Set());
      setInitialLoadDone(false);
    } else {
      setKnownMessageIds(new Set(messages.map((message) => message.id)));
      setInitialLoadDone(true);
    }
  } else if (!loading && !initialLoadDone) {
    setKnownMessageIds(new Set(messages.map((message) => message.id)));
    setInitialLoadDone(true);
  }

  const commentThreadIds = useMemo(
    () => [...new Set(messages.map(getCommentThreadMessageId))],
    [messages],
  );
  const senderLabelsById = useInboxSenderLabels(messages);
  const { commentCountByMessageId, incrementCommentCount } =
    useMessageCommentCounts(commentThreadIds, recipientKeyId);

  const handleAnimationDone = useCallback((messageId: string) => {
    setKnownMessageIds((prev) => {
      if (prev.has(messageId)) {
        return prev;
      }
      const next = new Set(prev);
      next.add(messageId);
      return next;
    });
  }, []);

  const getDecryption = useCallback(
    (messageId: string): MessageDecryptionResult =>
      decryptionById[messageId] ?? { text: null, error: null },
    [decryptionById],
  );

  const handleDecryptOne = useCallback(
    (messageId: string) => {
      const message = messages.find((entry) => entry.id === messageId);
      if (!message || !recipientKeyId) {
        return;
      }

      setBulkDecryptError(null);
      setDecryptionById((prev) => ({
        ...prev,
        [messageId]: { text: null, error: null },
      }));

      void (async () => {
        setDecryptingMessageId(messageId);
        try {
          const { message: messageResult, comments: commentResults } =
            await decryptStoredMessageAndCommentsWithUploadedPrivateKey(
              message,
              recipientKeyId,
            );
          setDecryptionById((prev) => ({
            ...prev,
            [messageId]: messageResult,
          }));
          setCommentDecryptionByMessageId((prev) => ({
            ...prev,
            [messageId]: { ...prev[messageId], ...commentResults },
          }));
        } catch (e) {
          if (isPrivateKeyFileSelectionCancelled(e)) {
            return;
          }
          setDecryptionById((prev) => ({
            ...prev,
            [messageId]: {
              text: null,
              error: errorMessage(e, 'Decryption failed.'),
            },
          }));
        } finally {
          setDecryptingMessageId(null);
        }
      })();
    },
    [messages, recipientKeyId],
  );

  const handleDecryptComment = useCallback(
    (messageId: string, commentId: string) => {
      const message = messages.find((entry) => entry.id === messageId);
      if (!message || !recipientKeyId) {
        return;
      }

      void (async () => {
        setDecryptingCommentId(commentId);
        setCommentDecryptionByMessageId((prev) => ({
          ...prev,
          [messageId]: {
            ...prev[messageId],
            [commentId]: { text: null, error: null },
          },
        }));

        try {
          const commentThreadId = getCommentThreadMessageId(message);
          const comments = await listDecryptableCommentsForMessage(
            commentThreadId,
            recipientKeyId,
          );
          const comment = comments.find((entry) => entry.id === commentId);
          if (!comment) {
            return;
          }

          const updates = await decryptCommentsWithUploadedPrivateKey(
            [comment],
            recipientKeyId,
          );
          setCommentDecryptionByMessageId((prev) => ({
            ...prev,
            [messageId]: { ...prev[messageId], ...updates },
          }));
        } catch (e) {
          if (isPrivateKeyFileSelectionCancelled(e)) {
            return;
          }
          setCommentDecryptionByMessageId((prev) => ({
            ...prev,
            [messageId]: {
              ...prev[messageId],
              [commentId]: {
                text: null,
                error: errorMessage(e, 'Decryption failed.'),
              },
            },
          }));
        } finally {
          setDecryptingCommentId(null);
        }
      })();
    },
    [messages, recipientKeyId],
  );

  const handleBulkDecrypt = useCallback(() => {
    if (!recipientKeyId || messages.length === 0) {
      return;
    }

    setBulkDecryptError(null);

    void (async () => {
      setBulkDecrypting(true);
      try {
        const { messages: messageUpdates, commentsByMessageId } =
          await decryptMessagesAndCommentsWithUploadedPrivateKey(
            messages,
            recipientKeyId,
          );
        setDecryptionById((prev) => ({ ...prev, ...messageUpdates }));
        setCommentDecryptionByMessageId((prev) => {
          const merged = { ...prev };
          for (const [id, commentUpdates] of Object.entries(
            commentsByMessageId,
          )) {
            merged[id] = { ...merged[id], ...commentUpdates };
          }
          return merged;
        });
      } catch (e) {
        if (isPrivateKeyFileSelectionCancelled(e)) {
          return;
        }
        setBulkDecryptError(errorMessage(e, 'Bulk decryption failed.'));
      } finally {
        setBulkDecrypting(false);
      }
    })();
  }, [messages, recipientKeyId]);

  const decryptBusy =
    bulkDecrypting ||
    decryptingMessageId !== null ||
    decryptingCommentId !== null;

  if (loading) {
    return (
      <Box sx={{ display: 'flex', alignItems: 'center', gap: 1.5, py: 1 }}>
        <CircularProgress size={20} />
        <Typography variant="body2" color="text.secondary">
          Loading messages…
        </Typography>
      </Box>
    );
  }

  return (
    <Stack spacing={2}>
      <Box
        sx={{
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          gap: 1,
          flexWrap: 'wrap',
        }}
      >
        <Typography variant="h6">Messages</Typography>
        {recipientKeyId && messages.length > 0 && (
          <Button
            size="small"
            variant="outlined"
            onClick={handleBulkDecrypt}
            disabled={decryptBusy}
            startIcon={<LockOpenIcon />}
          >
            {bulkDecrypting ? 'Decrypting…' : 'Bulk decrypt'}
          </Button>
        )}
      </Box>

      {bulkDecryptError && (
        <Typography color="error" variant="body2">
          {bulkDecryptError}
        </Typography>
      )}

      {error && (
        <Typography color="error" variant="body2">
          {error}
        </Typography>
      )}

      {!error && messages.length === 0 && (
        <Typography variant="body2" color="text.secondary">
          No messages yet.
        </Typography>
      )}

      {messages.map((message) => {
        if (!recipientKeyId) {
          return null;
        }

        const animateEntry =
          initialLoadDone && !knownMessageIds.has(message.id);

        const decryption = getDecryption(message.id);

        return (
          <MessageInboxItemPopIn
            key={message.id}
            messageId={message.id}
            animateEntry={animateEntry}
            onAnimationDone={handleAnimationDone}
          >
            <MessageInboxItem
              message={message}
              senderLabel={senderLabelsById[message.id] ?? 'Unknown sender'}
              decryption={decryption}
              decrypting={decryptingMessageId === message.id}
              decryptDisabled={
                bulkDecrypting ||
                decryptingMessageId === message.id ||
                decryption.text !== null
              }
              onDecrypt={() => handleDecryptOne(message.id)}
              recipientKeyId={recipientKeyId}
              commentCount={
                commentCountByMessageId[getCommentThreadMessageId(message)] ?? 0
              }
              onCommentPosted={() =>
                incrementCommentCount(getCommentThreadMessageId(message))
              }
              commentDecryptionById={
                commentDecryptionByMessageId[message.id] ?? {}
              }
              decryptingCommentId={decryptingCommentId}
              onDecryptComment={(commentId) =>
                handleDecryptComment(message.id, commentId)
              }
              onShare={() => setShareSourceMessage(message)}
            />
          </MessageInboxItemPopIn>
        );
      })}

      <ShareMessageDialog
        open={shareSourceMessage !== null}
        sourceMessage={shareSourceMessage}
        onClose={() => setShareSourceMessage(null)}
        onShared={(shareDelivery) => {
          onShareCreated?.(shareDelivery);
        }}
      />
    </Stack>
  );
}
