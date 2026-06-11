import React, { useCallback } from 'react';
import Avatar from '@mui/material/Avatar';
import Box from '@mui/material/Box';
import Button from '@mui/material/Button';
import IconButton from '@mui/material/IconButton';
import CircularProgress from '@mui/material/CircularProgress';
import Stack from '@mui/material/Stack';
import TextField from '@mui/material/TextField';
import Typography from '@mui/material/Typography';
import CloseIcon from '@mui/icons-material/Close';
import LockOpenIcon from '@mui/icons-material/LockOpen';
import SendIcon from '@mui/icons-material/Send';
import type { MessageDecryptionResult } from '@/crypto/messageDecrypt.ts';
import { useEncryptComment } from '@/hooks/useEncryptComment.ts';
import type { StoredComment } from '@/crypto/storedComments.ts';
import type { InboxComment } from '@/hooks/useMessageComments.ts';
import { useRelativeTime } from '@/hooks/useRelativeTime.ts';
import { nameInitial } from '@/utils/nameInitial.ts';

type MessageCommentsProps = {
  messageId: string;
  recipientKeyId: string;
  comments: InboxComment[];
  commentsLoading: boolean;
  commentsError: string | null;
  commentDecryptionById: Record<string, MessageDecryptionResult>;
  decryptingCommentId: string | null;
  onDecryptComment: (commentId: string) => void;
  onCommentPosted: (comment: StoredComment) => void;
  onClose: () => void;
};

function CommentItem({
  comment,
  decryption,
  decrypting,
  decryptDisabled,
  onDecrypt,
  showDecryptButton,
}: {
  comment: InboxComment;
  decryption: MessageDecryptionResult;
  decrypting: boolean;
  decryptDisabled: boolean;
  onDecrypt: () => void;
  showDecryptButton: boolean;
}) {
  const { text: decryptedText, error: decryptError } = decryption;
  const postedAgo = useRelativeTime(comment.createdAt);

  return (
    <Box
      sx={{
        pl: 1.5,
        borderLeft: 2,
        borderColor: 'divider',
      }}
    >
      <Stack spacing={0.75}>
        <Box sx={{ display: 'flex', gap: 1, alignItems: 'flex-start' }}>
          <Avatar
            sx={{ width: 28, height: 28, fontSize: '0.75rem', fontWeight: 600 }}
          >
            {nameInitial(comment.authorLabel)}
          </Avatar>
          <Box sx={{ minWidth: 0, flex: 1 }}>
            <Typography
              variant="caption"
              noWrap
              component="span"
              sx={{ fontWeight: 600 }}
            >
              {comment.authorLabel}
            </Typography>
            <Typography
              variant="caption"
              color="text.secondary"
              sx={{ ml: 0.75 }}
            >
              {postedAgo}
            </Typography>
          </Box>
        </Box>

        {decryptError && (
          <Typography color="error" variant="caption">
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
          {decryptedText ?? 'Encrypted comment — decrypt to read.'}
        </Typography>

        {showDecryptButton && (
          <Button
            size="small"
            variant="text"
            onClick={onDecrypt}
            disabled={decryptDisabled}
            startIcon={<LockOpenIcon fontSize="small" />}
            sx={{ alignSelf: 'flex-start', minWidth: 0, px: 0.5 }}
          >
            {decrypting ? 'Decrypting…' : 'Decrypt'}
          </Button>
        )}
      </Stack>
    </Box>
  );
}

export function MessageComments({
  messageId,
  comments,
  commentsLoading,
  commentsError,
  commentDecryptionById,
  decryptingCommentId,
  onDecryptComment,
  onCommentPosted,
  onClose,
}: MessageCommentsProps) {
  const {
    keysLoading,
    keysReady,
    commentText,
    setCommentText,
    error: postError,
    busy: posting,
    handlePost,
  } = useEncryptComment({
    messageId,
    onCommentPosted,
  });

  const getDecryption = useCallback(
    (commentId: string): MessageDecryptionResult =>
      commentDecryptionById[commentId] ?? { text: null, error: null },
    [commentDecryptionById],
  );

  const handleSubmit = useCallback(
    async (event: React.SubmitEvent) => {
      event.preventDefault();
      await handlePost();
    },
    [handlePost],
  );

  return (
    <Stack spacing={1.5} sx={{ pt: 1 }}>
      <Box sx={{ display: 'flex', justifyContent: 'flex-end' }}>
        <IconButton size="small" onClick={onClose} aria-label="Close comments">
          <CloseIcon fontSize="small" />
        </IconButton>
      </Box>

      {commentsLoading && (
        <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
          <CircularProgress size={16} />
          <Typography variant="body2" color="text.secondary">
            Loading comments…
          </Typography>
        </Box>
      )}

      {commentsError && (
        <Typography color="error" variant="body2">
          {commentsError}
        </Typography>
      )}

      {!commentsLoading && !commentsError && comments.length === 0 && (
        <Typography variant="body2" color="text.secondary">
          No comments yet.
        </Typography>
      )}

      {comments.map((comment) => {
        const decryption = getDecryption(comment.id);
        return (
          <CommentItem
            key={comment.id}
            comment={comment}
            decryption={decryption}
            decrypting={decryptingCommentId === comment.id}
            decryptDisabled={decryptingCommentId === comment.id}
            showDecryptButton={decryption.text === null}
            onDecrypt={() => onDecryptComment(comment.id)}
          />
        );
      })}

      {keysLoading ? (
        <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
          <CircularProgress size={16} />
          <Typography variant="body2" color="text.secondary">
            Loading keys…
          </Typography>
        </Box>
      ) : (
        <Box component="form" onSubmit={handleSubmit}>
          <Stack spacing={1}>
            <TextField
              size="small"
              placeholder="Write a comment…"
              value={commentText}
              onChange={(e) => setCommentText(e.target.value)}
              multiline
              minRows={2}
              disabled={!keysReady || posting}
              fullWidth
            />
            {(postError || !keysReady) && (
              <Typography
                variant="caption"
                color={postError ? 'error' : 'text.secondary'}
              >
                {postError ?? 'Generate or load keys before commenting.'}
              </Typography>
            )}
            <Button
              type="submit"
              size="small"
              variant="contained"
              disabled={!keysReady || posting || !commentText.trim()}
              startIcon={<SendIcon />}
            >
              {posting ? 'Posting…' : 'Post comment'}
            </Button>
          </Stack>
        </Box>
      )}
    </Stack>
  );
}
