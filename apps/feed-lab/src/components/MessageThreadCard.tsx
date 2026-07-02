import React, { memo, useCallback, useEffect, useState } from 'react';
import {
  Alert,
  Avatar,
  Box,
  Button,
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
  comments: StoredComment[];
  commentsLoading: boolean;
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
  comments,
  commentsLoading,
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
              {commentsLoading ? 'Comments' : `Comments (${comments.length})`}
            </Typography>
          </Divider>

          <Box>
            {commentsLoading ? (
              <Typography variant="body2" color="text.secondary">
                Loading comments…
              </Typography>
            ) : (
              <>
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
                          viewerKeyId={viewerKeyId}
                        />
                      );
                    })}
                    {comments.length > 0 &&
                    Object.keys(decryptedComments).length === 0 ? (
                      <Typography variant="body2" color="text.secondary">
                        Could not decrypt comments.
                      </Typography>
                    ) : null}
                  </Stack>
                ) : null}
                {comments.length === 0 ? (
                  <Typography variant="body2" color="text.secondary">
                    No comments yet.
                  </Typography>
                ) : null}
              </>
            )}
          </Box>

          <CommentComposer
            commentsPostBusy={commentsPostBusy}
            messageDecrypted={decryptPlaintext !== null}
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
}

function CommentRow({
  comment,
  text,
  usernameByKeyId,
  viewerKeyId,
}: {
  comment: StoredComment;
  text: string;
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
    <Paper variant="outlined" sx={{ p: 1.5 }}>
      <Stack spacing={0.75}>
        <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
          <Avatar
            sx={{
              width: 28,
              height: 28,
              fontSize: isOwnComment ? '0.625rem' : '0.75rem',
              fontWeight: 600,
            }}
          >
            {isOwnComment ? 'ME' : nameInitial(authorLabel ?? '?')}
          </Avatar>
          {!isOwnComment ? (
            <Typography variant="caption" sx={{ fontWeight: 600 }}>
              {authorLabel ?? '...'}
            </Typography>
          ) : null}
        </Box>
        <Typography variant="body2" sx={{ whiteSpace: 'pre-wrap' }}>
          {text}
        </Typography>
      </Stack>
    </Paper>
  );
}
