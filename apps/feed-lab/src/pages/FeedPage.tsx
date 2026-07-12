import React, { useCallback, useMemo, useState } from 'react';
import { Button, Stack, Typography } from '@mui/material';
import RefreshOutlinedIcon from '@mui/icons-material/RefreshOutlined';
import SendOutlinedIcon from '@mui/icons-material/SendOutlined';
import type { StoredComment } from '@encrypt/core/feed/types';
import { useBackendFeedData } from '@lab/hooks/useBackendFeedData.ts';
import { useBackendDecrypt } from '@lab/hooks/useBackendDecrypt.ts';
import { useBackendComments } from '@lab/hooks/useBackendComments.ts';
import { useBackendShare } from '@lab/hooks/useBackendShare.ts';
import { useFeedLabFriendships } from '@lab/hooks/useFeedLabFriendships.ts';
import { useFeedLabRecipients } from '@lab/hooks/useFeedLabRecipients.ts';
import { MessageThreadCard } from '@lab/components/MessageThreadCard.tsx';
import { MessageSentSnackbar } from '@lab/components/MessageSentSnackbar.tsx';
import { SendMessageDialog } from '@lab/components/SendMessageDialog.tsx';
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
  const [createMessageDialogOpen, setCreateMessageDialogOpen] = useState(false);
  const [shareTargetMessageId, setShareTargetMessageId] = useState<
    string | null
  >(null);
  const [sentMessageNotice, setSentMessageNotice] = useState<{
    messageId: string;
  } | null>(null);

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
  const {
    clear: clearDecrypt,
    mergeDecryptedComments,
    decryptDelivery,
    decryptComments,
    busyMessageId,
    busyCommentsMessageId,
    decryptedMessages,
    messageErrors,
    decryptedCommentsByMessage,
    commentsErrors,
  } = decrypt;
  const share = useBackendShare(keys.withPrivateKey, keys.keyId);
  const {
    clearLastShare,
    clearError: clearShareError,
    busy: shareBusy,
    lastShare,
  } = share;
  const {
    comments: loadedComments,
    loading: commentsLoading,
    postBusy: commentsPostBusy,
    postComment,
    decryptCommentText,
  } = useBackendComments(selectedMessageId, keys.keyId, keys.withPrivateKey);

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
          clearLastShare();
        }
        return next;
      });
    },
    [clearLastShare],
  );

  const handleReloadFeed = useCallback(async () => {
    if (!keys.keyId) {
      return;
    }
    clearDecrypt();
    await feed.reload();
  }, [clearDecrypt, feed, keys.keyId]);

  const handleSendSuccess = useCallback(async () => {
    if (keys.keyId) {
      await feed.reload();
    }
  }, [feed, keys.keyId]);

  const handleMessageSent = useCallback((detail: { messageId: string }) => {
    setSentMessageNotice(detail);
  }, []);

  const handleCloseSentMessageNotice = useCallback(() => {
    setSentMessageNotice(null);
  }, []);

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
      const newComment = await postComment({
        messageId,
        allDeliveries: feed.allDeliveries,
        manifestLookup: feed.manifestLookup,
        text,
      });
      if (!newComment) {
        return;
      }

      const decryptedText = await decryptCommentText(newComment, {
        allDeliveries: feed.allDeliveries,
        manifestLookup: feed.manifestLookup,
      });
      if (decryptedText) {
        mergeDecryptedComments(messageId, { [newComment.id]: decryptedText });
      }
    },
    [
      postComment,
      decryptCommentText,
      feed.allDeliveries,
      feed.manifestLookup,
      mergeDecryptedComments,
    ],
  );

  return (
    <>
      <Stack
        direction="row"
        sx={{
          alignItems: 'center',
          justifyContent: 'flex-start',
          flexWrap: 'wrap',
          gap: 1,
        }}
      >
        <Button
          variant="outlined"
          size="small"
          startIcon={<RefreshOutlinedIcon />}
          disabled={!keys.keyId || feed.loading}
          onClick={() => void handleReloadFeed()}
        >
          Refresh feed
        </Button>
        <Button
          variant="contained"
          size="small"
          startIcon={<SendOutlinedIcon />}
          disabled={!keys.keyId}
          onClick={() => setCreateMessageDialogOpen(true)}
        >
          Create message
        </Button>
      </Stack>

      <Stack spacing={1.5}>
        {feed.messages.map((message) => {
          const isExpanded = selectedMessageId === message.id;
          const decryptedComments =
            decryptedCommentsByMessage[message.id] ?? null;
          return (
            <MessageThreadCard
              key={message.id}
              message={message}
              expanded={isExpanded}
              comments={isExpanded ? loadedComments : EMPTY_COMMENTS}
              commentsLoading={isExpanded && commentsLoading}
              commentsPostBusy={isExpanded && commentsPostBusy}
              onToggleMessage={handleToggleMessage}
              onDecryptDelivery={decryptDelivery}
              onDecryptComments={decryptComments}
              decryptBusy={busyMessageId === message.id}
              decryptCommentsBusy={busyCommentsMessageId === message.id}
              decryptError={messageErrors[message.id] ?? null}
              decryptCommentsError={commentsErrors[message.id] ?? null}
              decryptPlaintext={decryptedMessages[message.id] ?? null}
              decryptedComments={isExpanded ? decryptedComments : null}
              shareBusy={shareBusy}
              shareLastShareId={
                isExpanded && lastShare?.messageId === message.id
                  ? lastShare.shareId
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

      <SendMessageDialog
        open={createMessageDialogOpen}
        withPrivateKey={keys.withPrivateKey}
        keyId={keys.keyId}
        recipients={recipients}
        onClose={() => setCreateMessageDialogOpen(false)}
        onSendSuccess={handleSendSuccess}
        onMessageSent={handleMessageSent}
      />

      <MessageSentSnackbar
        messageId={sentMessageNotice?.messageId ?? null}
        onClose={handleCloseSentMessageNotice}
      />

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
