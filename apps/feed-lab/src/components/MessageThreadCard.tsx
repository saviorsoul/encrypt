import React, { useEffect, useState } from 'react';
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
import { useBackendDecrypt } from '@lab/hooks/useBackendDecrypt.ts';
import { useBackendShare } from '@lab/hooks/useBackendShare.ts';
import { formatCommentAuthorLabel } from '@lab/lib/formatCommentAuthorLabel.ts';
import { sanitizeDisplayText } from '@lab/lib/sanitizeDisplayText.ts';

type MessageThreadCardProps = {
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
};

export function MessageThreadCard({
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
              Decrypt
            </Button>
            <Button
              variant="outlined"
              size="small"
              disabled={share.busy}
              onClick={onOpenShare}
            >
              Share
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

          <Box>
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
            ) : null}
          </Box>

          <TextField
            fullWidth
            multiline
            minRows={3}
            label="New comment"
            value={commentText}
            onChange={(event) => onCommentTextChange(event.target.value)}
            sx={{ my: 2 }}
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
