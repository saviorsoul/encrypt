import React, { useCallback, useMemo, useState } from 'react';
import {
  Alert,
  Button,
  CircularProgress,
  Paper,
  Stack,
  Typography,
} from '@mui/material';
import type { StoredComment } from '@encrypt/core/feed/types';
import { useBackendFeedData } from '@lab/hooks/useBackendFeedData.ts';
import { useBackendDecrypt } from '@lab/hooks/useBackendDecrypt.ts';
import { useBackendComments } from '@lab/hooks/useBackendComments.ts';
import { useBackendShare } from '@lab/hooks/useBackendShare.ts';
import { useFeedLabFriendships } from '@lab/hooks/useFeedLabFriendships.ts';
import { useFeedLabRecipients } from '@lab/hooks/useFeedLabRecipients.ts';
import { MessageThreadCard } from '@lab/components/MessageThreadCard.tsx';
import { SendMessagePanel } from '@lab/components/SendMessagePanel.tsx';
import { ShareMessageDialog } from '@lab/components/ShareMessageDialog.tsx';
import { useFeedLabSession } from '@lab/providers/FeedLabSessionProvider.tsx';

const EMPTY_COMMENTS: StoredComment[] = [];

export function FeedPage() {
  const { keys, feedLabUsers } = useFeedLabSession();
  const { usernameByKeyId, addLocalUser } = feedLabUsers;
  const feed = useBackendFeedData(keys.keyId);
  const [selectedMessageId, setSelectedMessageId] = useState<string | null>(
    null,
  );
  const [shareDialogOpen, setShareDialogOpen] = useState(false);
  const [shareTargetMessageId, setShareTargetMessageId] = useState<
    string | null
  >(null);

  const friendships = useFeedLabFriendships(
    keys.keyId,
    usernameByKeyId,
    addLocalUser,
  );
  const recipients = useFeedLabRecipients({
    viewerKeyId: keys.keyId,
    friends: friendships.friends,
    loadingFriends: friendships.loading,
    friendsError: friendships.error,
  });
  const decrypt = useBackendDecrypt(keys.withPrivateKey);
  const { clear: clearDecrypt, mergeDecryptedComments } = decrypt;
  const share = useBackendShare(keys.withPrivateKey, keys.keyId);
  const { clearLastShare, clearError: clearShareError } = share;
  const comments = useBackendComments(
    selectedMessageId,
    keys.keyId,
    keys.withPrivateKey,
  );

  const feedContext = useMemo(
    () => ({
      allDeliveries: feed.allDeliveries,
      manifestLookup: feed.manifestLookup,
    }),
    [feed.allDeliveries, feed.manifestLookup],
  );

  const handleToggleMessage = useCallback(
    (messageId: string) => {
      setSelectedMessageId((current) => {
        const next = current === messageId ? null : messageId;
        if (next !== current) {
          clearDecrypt();
          clearLastShare();
        }
        return next;
      });
    },
    [clearDecrypt, clearLastShare],
  );

  const handleReloadFeed = useCallback(async () => {
    if (!keys.keyId) {
      const keyId = await keys.changeKeyId();
      if (!keyId) {
        return;
      }
    }
    await feed.reload();
  }, [keys, feed]);

  const handleSendSuccess = useCallback(async () => {
    if (keys.keyId) {
      await feed.reload();
    }
  }, [feed, keys.keyId]);

  const handleOpenShare = useCallback(
    (messageId: string) => {
      clearShareError();
      setShareTargetMessageId(messageId);
      setShareDialogOpen(true);
    },
    [clearShareError],
  );

  const handleCloseShareDialog = useCallback(() => {
    setShareDialogOpen(false);
    setShareTargetMessageId(null);
    clearShareError();
  }, [clearShareError]);

  const handlePostComment = useCallback(
    async (messageId: string, text: string) => {
      const newComment = await comments.postComment({
        messageId,
        allDeliveries: feed.allDeliveries,
        manifestLookup: feed.manifestLookup,
        text,
      });
      if (!newComment) {
        return;
      }

      const decryptedText = await comments.decryptCommentText(newComment, {
        allDeliveries: feed.allDeliveries,
        manifestLookup: feed.manifestLookup,
      });
      if (decryptedText) {
        mergeDecryptedComments({ [newComment.id]: decryptedText });
      }
    },
    [comments, feed.allDeliveries, feed.manifestLookup, mergeDecryptedComments],
  );

  return (
    <>
      <SendMessagePanel
        withPrivateKey={keys.withPrivateKey}
        keyId={keys.keyId}
        recipients={recipients}
        onSendSuccess={handleSendSuccess}
      />

      <Paper sx={{ p: 2 }}>
        <Stack
          direction="row"
          sx={{
            mb: 2,
            justifyContent: 'space-between',
            alignItems: 'center',
          }}
        >
          <Typography variant="h6">Feed data for your keyId</Typography>
          <Button
            onClick={() => void handleReloadFeed()}
            disabled={feed.loading}
          >
            {feed.loading ? 'Loading…' : 'Reload all'}
          </Button>
        </Stack>
        <Typography variant="body2" color="text.secondary" sx={{ mb: 2 }}>
          Loads inbox from the backend for your keyId. Set your keyId from a
          private JWK file; the private key is not stored. Comments load when
          you expand a message.
        </Typography>
        {feed.error ? <Alert severity="warning">{feed.error}</Alert> : null}
        {feed.loading ? (
          <Stack direction="row" spacing={1} sx={{ alignItems: 'center' }}>
            <CircularProgress size={18} />
            <Typography variant="body2">Loading inbox…</Typography>
          </Stack>
        ) : null}
        {keys.keyId && !feed.loading ? (
          <Typography variant="body2" color="text.secondary" sx={{ mb: 2 }}>
            {feed.messages.length} message(s).
          </Typography>
        ) : null}
        <Stack spacing={1}>
          {feed.messages.map((message) => {
            const isExpanded = selectedMessageId === message.id;
            return (
              <MessageThreadCard
                key={message.id}
                message={message}
                expanded={isExpanded}
                comments={
                  isExpanded && selectedMessageId === message.id
                    ? comments.comments
                    : EMPTY_COMMENTS
                }
                commentsLoading={
                  isExpanded &&
                  selectedMessageId === message.id &&
                  comments.loading
                }
                commentsPostBusy={isExpanded && comments.postBusy}
                onToggleMessage={handleToggleMessage}
                onDecryptDelivery={decrypt.decryptDelivery}
                decryptBusy={isExpanded && decrypt.busy}
                decryptError={isExpanded ? decrypt.error : null}
                decryptPlaintext={isExpanded ? decrypt.plaintext : null}
                decryptedComments={
                  isExpanded ? decrypt.decryptedComments : null
                }
                shareBusy={share.busy}
                shareLastShareId={
                  isExpanded && share.lastShare?.messageId === message.id
                    ? share.lastShare.shareId
                    : null
                }
                onOpenShare={handleOpenShare}
                onPostCommentForMessage={handlePostComment}
                feedContext={feedContext}
                usernameByKeyId={usernameByKeyId}
                viewerKeyId={keys.keyId}
              />
            );
          })}
          {keys.keyId && !feed.loading && feed.messages.length === 0 ? (
            <Typography color="text.secondary">
              No data yet for this keyId.
            </Typography>
          ) : null}
        </Stack>
      </Paper>

      <ShareMessageDialog
        open={shareDialogOpen}
        messageId={shareTargetMessageId}
        busy={share.busy}
        error={share.error}
        recipientOptions={recipients.recipientOptions}
        selectedRecipients={recipients.selectedKeyIds}
        onSelectedRecipientsChange={recipients.setSelectedKeyIds}
        getOptionLabel={recipients.getOptionLabel}
        recipients={recipients.recipients}
        loadingRecipients={
          recipients.loadingFriends || recipients.loadingRecipientKeys
        }
        recipientsError={recipients.error}
        onClose={handleCloseShareDialog}
        onClearError={clearShareError}
        onShare={(shareRecipients) =>
          share
            .shareMessage({
              messageId: shareTargetMessageId ?? '',
              recipients: shareRecipients,
              allDeliveries: feed.allDeliveries,
              manifestLookup: feed.manifestLookup,
            })
            .then(async (shareId) => {
              if (shareId && keys.keyId) {
                await feed.reload();
              }
              return shareId;
            })
        }
      />
    </>
  );
}
