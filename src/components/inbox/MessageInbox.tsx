import React, { useCallback, useMemo, useState } from 'react';
import Box from '@mui/material/Box';
import Button from '@mui/material/Button';
import CircularProgress from '@mui/material/CircularProgress';
import Stack from '@mui/material/Stack';
import Typography from '@mui/material/Typography';
import LockOpenIcon from '@mui/icons-material/LockOpen';
import FileUploadOutlinedIcon from '@mui/icons-material/FileUploadOutlined';
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
import { MessageFeedCard } from '@/components/inbox/MessageFeedCard.tsx';
import { ShareMessageDialog } from '@/components/inbox/ShareMessageDialog.tsx';
import { ImportFeedMessageDialog } from '@/components/inbox/ImportFeedMessageDialog.tsx';
import { useExternalImportDestination } from '@/hooks/useExternalImportDestination.ts';
import type { PendingExternalImport } from '@/components/providers/ExternalFileProvider.tsx';
import { useMessageCommentCounts } from '@/hooks/useMessageCommentCounts.ts';
import { getCommentThreadMessageId } from '@/crypto/manifestShare.ts';
import type { StoredMessage } from '@/services/db/storedMessages.ts';

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
  onMessageImported?: (message: StoredMessage) => void;
};

export function MessageInbox({
  messages,
  loading,
  error,
  recipientKeyId,
  onShareCreated,
  onMessageImported,
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
  const [importDialogOpen, setImportDialogOpen] = useState(false);
  const [externalImportSession, setExternalImportSession] =
    useState<PendingExternalImport | null>(null);

  const handlePendingExternalImport = useCallback(
    (consumed: PendingExternalImport) => {
      setExternalImportSession(consumed);
      setImportDialogOpen(true);
    },
    [],
  );

  useExternalImportDestination('feed', handlePendingExternalImport);

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
        {recipientKeyId && (
          <Box sx={{ display: 'flex', gap: 1, flexWrap: 'wrap' }}>
            <Button
              size="small"
              variant="outlined"
              onClick={() => {
                setExternalImportSession(null);
                setImportDialogOpen(true);
              }}
              startIcon={<FileUploadOutlinedIcon />}
            >
              Import message
            </Button>
            {messages.length > 0 && (
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
            <MessageFeedCard
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

      <ImportFeedMessageDialog
        open={importDialogOpen}
        recipientKeyId={recipientKeyId}
        existingMessages={messages}
        initialPayload={externalImportSession?.text ?? null}
        initialFileName={externalImportSession?.fileName ?? null}
        externalImport={externalImportSession !== null}
        onClose={() => {
          setImportDialogOpen(false);
          setExternalImportSession(null);
        }}
        onImported={(message) => {
          onMessageImported?.(message);
        }}
      />
    </Stack>
  );
}
