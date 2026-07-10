import React from 'react';
import { MessageComments } from '@/components/inbox/MessageComments.tsx';
import { useMessageComments } from '@/hooks/useMessageComments.ts';
import type { StoredComment } from '@/services/db/storedComments.ts';
import type { MessageDecryptionResult } from '@/crypto/messageDecrypt.ts';

type MessageCommentsPanelProps = {
  messageId: string;
  recipientKeyId: string;
  commentsRefreshKey?: number;
  commentDecryptionById: Record<string, MessageDecryptionResult>;
  decryptingCommentId: string | null;
  onDecryptComment: (commentId: string) => void;
  onCommentPosted?: () => void;
  onClose: () => void;
};

export function MessageCommentsPanel({
  messageId,
  recipientKeyId,
  commentsRefreshKey = 0,
  commentDecryptionById,
  decryptingCommentId,
  onDecryptComment,
  onCommentPosted,
  onClose,
}: MessageCommentsPanelProps) {
  const { comments, loading, error, prependComment } = useMessageComments(
    messageId,
    recipientKeyId,
    commentsRefreshKey,
  );

  const handleCommentPosted = (comment: StoredComment) => {
    void prependComment(comment);
    onCommentPosted?.();
  };

  return (
    <MessageComments
      messageId={messageId}
      recipientKeyId={recipientKeyId}
      comments={comments}
      commentsLoading={loading}
      commentsError={error}
      commentDecryptionById={commentDecryptionById}
      decryptingCommentId={decryptingCommentId}
      onDecryptComment={onDecryptComment}
      onCommentPosted={handleCommentPosted}
      onClose={onClose}
    />
  );
}
