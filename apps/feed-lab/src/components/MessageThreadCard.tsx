import React, { memo, useCallback, useEffect, useState } from 'react';
import {
  Alert,
  Avatar,
  Box,
  Button,
  Chip,
  Collapse,
  Divider,
  Paper,
  Stack,
  TextField,
  Typography,
} from '@mui/material';
import { nameInitial } from '@/utils/nameInitial.ts';
import { getCommentAuthorKeyIdFromPayload } from '@encrypt/core/crypto/commentCrypto';
import { getSenderKeyIdFromCorePayload } from '@encrypt/core/crypto/manifestDecrypt';
import type { StoredComment, StoredMessage } from '@encrypt/core/feed/types';
import type { useBackendDecrypt } from '@lab/hooks/useBackendDecrypt.ts';
import { formatCommentAuthorLabel } from '@lab/lib/formatCommentAuthorLabel.ts';
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
  commentCount: number;
  comments: StoredComment[];
  commentsPostBusy: boolean;
  onToggleMessage: (messageId: string) => void;
  onDecryptDelivery: ReturnType<typeof useBackendDecrypt>['decryptDelivery'];
  decryptBusy: boolean;
  decryptError: string | null;
  decryptPlaintext: string | null;
  decryptedComments: Record<string, string> | null;
  shareBusy: boolean;
  shareLastShareId: string | null;
  onOpenShare: () => void;
  onPostCommentForMessage: (messageId: string, text: string) => Promise<void>;
  feedContext: FeedContext;
  usernameByKeyId: Record<string, string>;
  viewerKeyId: string | null;
};

export const MessageThreadCard = memo(function MessageThreadCard({
  message,
  expanded,
  commentCount,
  comments,
  commentsPostBusy,
  onToggleMessage,
  onDecryptDelivery,
  decryptBusy,
  decryptError,
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
      <Box
        onClick={() => onToggleMessage(message.id)}
        sx={{ cursor: 'pointer' }}
      >
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

      <Collapse in={expanded} timeout={200} unmountOnExit>
        <Box onClick={(event) => event.stopPropagation()} sx={{ pt: 1.5 }}>
          <Divider sx={{ mb: 1.5 }} />

          <Stack direction="row" spacing={1}>
            <Button
              variant="outlined"
              size="small"
              disabled={decryptBusy}
              onClick={() =>
                void onDecryptDelivery({
                  delivery: message,
                  allDeliveries: feedContext.allDeliveries,
                  manifestLookup: feedContext.manifestLookup,
                  comments,
                })
              }
            >
              Decrypt
            </Button>
            <Button
              variant="outlined"
              size="small"
              disabled={shareBusy}
              onClick={onOpenShare}
            >
              Share
            </Button>
          </Stack>

          {shareLastShareId ? (
            <Alert severity="success" sx={{ mt: 1 }}>
              Share created: {shareLastShareId}
            </Alert>
          ) : null}
          {decryptError ? (
            <Alert severity="error" sx={{ mt: 1 }}>
              {decryptError}
            </Alert>
          ) : null}
          {decryptPlaintext ? (
            <Paper variant="outlined" sx={{ mt: 2, p: 1.5 }}>
              <Typography variant="body2" sx={{ whiteSpace: 'pre-wrap' }}>
                {sanitizeDisplayText(decryptPlaintext)}
              </Typography>
            </Paper>
          ) : null}

          <Divider sx={{ my: 2 }}>
            <Typography variant="subtitle2">
              Comments ({commentCount})
            </Typography>
          </Divider>

          <Box>
            {decryptedComments !== null ? (
              <Stack spacing={1}>
                {comments.map((comment) => {
                  const text = decryptedComments[comment.id];
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
                Object.keys(decryptedComments).length === 0 ? (
                  <Typography variant="body2" color="text.secondary">
                    Could not decrypt comments.
                  </Typography>
                ) : null}
              </Stack>
            ) : null}
          </Box>

          <CommentComposer
            commentsPostBusy={commentsPostBusy}
            onPostCommentForMessage={onPostCommentForMessage}
            messageId={message.id}
          />
        </Box>
      </Collapse>
    </Paper>
  );
});

function CommentComposer({
  messageId,
  commentsPostBusy,
  onPostCommentForMessage,
}: {
  messageId: string;
  commentsPostBusy: boolean;
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
        sx={{ my: 2 }}
      />
      <Button
        variant="contained"
        size="small"
        disabled={commentsPostBusy || !commentText.trim()}
        onClick={() => void handlePostComment()}
      >
        {commentsPostBusy ? 'Posting…' : 'Add comment'}
      </Button>
    </>
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
