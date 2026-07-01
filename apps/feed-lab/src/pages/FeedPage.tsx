import React, {
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
} from 'react';
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
  const { usernameByKeyId } = feedLabUsers;
  const feed = useBackendFeedData(keys.keyId);
  const [selectedMessageId, setSelectedMessageId] = useState<string | null>(
    null,
  );
  const [shareDialogOpen, setShareDialogOpen] = useState(false);

  const friendships = useFeedLabFriendships(keys.keyId, usernameByKeyId);
  const recipients = useFeedLabRecipients({
    friends: friendships.friends,
    loadingFriends: friendships.loading,
    friendsError: friendships.error,
  });
  const decrypt = useBackendDecrypt(keys.withPrivateKey);
  const share = useBackendShare(keys.withPrivateKey);
  const comments = useBackendComments(
    selectedMessageId,
    keys.keyId,
    keys.withPrivateKey,
  );
  const selectedCommentIds = comments.comments
    .map((comment) => comment.id)
    .join('\0');
  const prevCommentIdsRef = useRef('');

  const feedContext = useMemo(
    () => ({
      allDeliveries: feed.allDeliveries,
      manifestLookup: feed.manifestLookup,
    }),
    [feed.allDeliveries, feed.manifestLookup],
  );

  useEffect(() => {
    const prev = prevCommentIdsRef.current;
    if (prev && prev !== selectedCommentIds) {
      decrypt.clearDecryptedComments();
    }
    prevCommentIdsRef.current = selectedCommentIds;
  }, [selectedCommentIds, decrypt.clearDecryptedComments]);

  const handleToggleMessage = useCallback(
    (messageId: string) => {
      setSelectedMessageId((current) => {
        const next = current === messageId ? null : messageId;
        if (next !== current) {
          decrypt.clear();
        }
        return next;
      });
    },
    [decrypt.clear],
  );

  const handleReloadFeed = useCallback(async () => {
    let recipientKeyId = keys.keyId;
    if (!recipientKeyId) {
      recipientKeyId = await keys.changeKeyId();
      if (!recipientKeyId) {
        return;
      }
    }
    await feed.reload(recipientKeyId);
  }, [keys, feed]);

  const handleSendSuccess = useCallback(async () => {
    if (keys.keyId) {
      await feed.reload(keys.keyId);
    }
  }, [feed, keys.keyId]);

  const handleOpenShare = useCallback(() => {
    setShareDialogOpen(true);
  }, []);

  const handlePostComment = useCallback(
    async (messageId: string, text: string) => {
      await comments.postComment({
        messageId,
        allDeliveries: feed.allDeliveries,
        manifestLookup: feed.manifestLookup,
        text,
      });
      await handleReloadFeed();
    },
    [comments, feed.allDeliveries, feed.manifestLookup, handleReloadFeed],
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
          Loads inbox and comments from the backend for your keyId. Set your
          keyId from a private JWK file; the private key is not stored. Decrypt
          and comment actions prompt for your key each time.
        </Typography>
        {feed.error ? <Alert severity="warning">{feed.error}</Alert> : null}
        {feed.loading ? (
          <Stack direction="row" spacing={1} sx={{ alignItems: 'center' }}>
            <CircularProgress size={18} />
            <Typography variant="body2">Loading inbox + comments…</Typography>
          </Stack>
        ) : null}
        {keys.keyId && !feed.loading ? (
          <Typography variant="body2" color="text.secondary" sx={{ mb: 2 }}>
            {feed.messages.length} message(s), {feed.totalComments} comment(s).
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
                commentCount={feed.commentsByMessageId[message.id]?.length ?? 0}
                comments={
                  isExpanded
                    ? (feed.commentsByMessageId[message.id] ?? EMPTY_COMMENTS)
                    : EMPTY_COMMENTS
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
                shareLastShareId={isExpanded ? share.lastShareId : null}
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
        messageId={selectedMessageId}
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
        onClose={() => setShareDialogOpen(false)}
        onClearError={share.clearError}
        onShare={(shareRecipients) =>
          selectedMessageId
            ? share
                .shareMessage({
                  messageId: selectedMessageId,
                  recipients: shareRecipients,
                  allDeliveries: feed.allDeliveries,
                  manifestLookup: feed.manifestLookup,
                })
                .then(async (shareId) => {
                  if (shareId && keys.keyId) {
                    await feed.reload(keys.keyId);
                  }
                  return shareId;
                })
            : Promise.resolve(null)
        }
      />
    </>
  );
}
