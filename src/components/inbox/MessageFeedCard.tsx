import React, { memo, useCallback, useState } from 'react';
import Avatar from '@mui/material/Avatar';
import Box from '@mui/material/Box';
import Button from '@mui/material/Button';
import Card from '@mui/material/Card';
import CardActions from '@mui/material/CardActions';
import CardContent from '@mui/material/CardContent';
import Divider from '@mui/material/Divider';
import IconButton from '@mui/material/IconButton';
import Stack from '@mui/material/Stack';
import Typography from '@mui/material/Typography';
import ChatBubbleOutlineOutlinedIcon from '@mui/icons-material/ChatBubbleOutlineOutlined';
import CheckIcon from '@mui/icons-material/Check';
import ContentCopyOutlinedIcon from '@mui/icons-material/ContentCopyOutlined';
import FavoriteBorderOutlinedIcon from '@mui/icons-material/FavoriteBorderOutlined';
import LockOpenIcon from '@mui/icons-material/LockOpen';
import ShareOutlinedIcon from '@mui/icons-material/ShareOutlined';
import type { MessageDecryptionResult } from '@/crypto/messageDecrypt.ts';
import { assembleStoredFeedMessageCopyPayload } from '@/crypto/exportFeedMessage.ts';
import { getCommentThreadMessageId } from '@/crypto/manifestShare.ts';
import type { StoredMessage } from '@/crypto/storedMessages.ts';
import { MessageCommentsPanel } from '@/components/inbox/MessageCommentsPanel.tsx';
import { useRelativeTime } from '@/hooks/useRelativeTime.ts';
import type { CopyState } from '@/types/copyState.ts';
import { copyTextToClipboard } from '@/utils/copyToClipboard.ts';
import { nameInitial } from '@/utils/nameInitial.ts';

function commentButtonLabel(count: number): string {
  return count > 0 ? `Comment (${count})` : 'Comment';
}

export type MessageFeedCardProps = {
  message: StoredMessage;
  senderLabel: string;
  decryption: MessageDecryptionResult;
  preview?: boolean;
  decrypting?: boolean;
  decryptDisabled?: boolean;
  onDecrypt?: () => void;
  recipientKeyId?: string;
  commentCount?: number;
  onCommentPosted?: () => void;
  commentDecryptionById?: Record<string, MessageDecryptionResult>;
  decryptingCommentId?: string | null;
  onDecryptComment?: (commentId: string) => void;
  onShare?: () => void;
};

export const MessageFeedCard = memo(function MessageFeedCard({
  message,
  senderLabel,
  decryption,
  preview = false,
  decrypting = false,
  decryptDisabled = false,
  onDecrypt,
  recipientKeyId,
  commentCount = 0,
  onCommentPosted,
  commentDecryptionById = {},
  decryptingCommentId = null,
  onDecryptComment,
  onShare,
}: MessageFeedCardProps) {
  const [commentsOpen, setCommentsOpen] = useState(false);
  const [copyState, setCopyState] = useState<CopyState>('idle');
  const [copyBusy, setCopyBusy] = useState(false);
  const { text: decryptedText, error: decryptError } = decryption;
  const sentAgo = useRelativeTime(message.createdAt);
  const commentThreadId = getCommentThreadMessageId(message);

  const handleCopy = useCallback(async () => {
    setCopyBusy(true);
    try {
      const payloadJson = await assembleStoredFeedMessageCopyPayload(message);
      await copyTextToClipboard(payloadJson);
      setCopyState('ok');
    } catch {
      setCopyState('err');
    } finally {
      setCopyBusy(false);
      window.setTimeout(() => setCopyState('idle'), 2000);
    }
  }, [message]);

  return (
    <Card variant={preview ? 'outlined' : 'elevation'}>
      <CardContent sx={{ pb: preview ? 2 : 1 }}>
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

      {!preview &&
        onDecrypt &&
        onShare &&
        recipientKeyId &&
        onCommentPosted &&
        onDecryptComment && (
          <>
            <CardActions sx={{ px: 2, pb: 2, pt: 0, gap: 1, flexWrap: 'wrap' }}>
              <IconButton size="small" color="primary" disabled>
                <FavoriteBorderOutlinedIcon />
              </IconButton>
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
                onClick={() => void handleCopy()}
                disabled={copyBusy}
                color={copyState === 'ok' ? 'success' : 'primary'}
                startIcon={
                  copyState === 'ok' ? (
                    <CheckIcon />
                  ) : (
                    <ContentCopyOutlinedIcon />
                  )
                }
              >
                Copy
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
          </>
        )}
    </Card>
  );
});
