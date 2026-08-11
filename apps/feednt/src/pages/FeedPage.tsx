import { useCallback, useEffect, useMemo, useState } from 'react';
import { Button, CircularProgress, Stack, Typography } from '@mui/material';
import RefreshOutlinedIcon from '@mui/icons-material/RefreshOutlined';
import SendOutlinedIcon from '@mui/icons-material/SendOutlined';
import { useBackendFeedData } from '@feednt/hooks/useBackendFeedData.ts';
import { useBackendDecrypt } from '@feednt/hooks/useBackendDecrypt.ts';
import { useBackendShare } from '@feednt/hooks/useBackendShare.ts';
import { useFeedntFriendships } from '@feednt/providers/FeedntFriendshipsProvider.tsx';
import { useFeedntRecipients } from '@feednt/hooks/useFeedntRecipients.ts';
import { useIdentityDialog } from '@feednt/hooks/useIdentityDialog.ts';
import { IdentityDialog } from '@feednt/components/IdentityDialog.tsx';
import { MessageThreadCard } from '@feednt/components/MessageThreadCard.tsx';
import { MessageSentSnackbar } from '@feednt/components/MessageSentSnackbar.tsx';
import { SendMessageDialog } from '@feednt/components/SendMessageDialog.tsx';
import { ShareMessageDialog } from '@feednt/components/ShareMessageDialog.tsx';
import { useFeedntSession } from '@feednt/providers/FeedntSessionProvider.tsx';

export function FeedPage() {
  const { session, keys, feedntUsers } = useFeedntSession();
  const { usernameByKeyId, usernames, addLocalUser } = feedntUsers;
  const feed = useBackendFeedData(session?.keyId ?? null);
  const { reload: reloadFeed } = feed;
  const [expandedMessageIds, setExpandedMessageIds] = useState<Set<string>>(
    () => new Set(),
  );
  const [lastInteractedMessageId, setLastInteractedMessageId] = useState<
    string | null
  >(null);
  const [shareDialogOpen, setShareDialogOpen] = useState(false);
  const [createMessageDialogOpen, setCreateMessageDialogOpen] = useState(false);
  const [shareTargetMessageId, setShareTargetMessageId] = useState<
    string | null
  >(null);
  const [sentMessageNotice, setSentMessageNotice] = useState<{
    messageId: string;
  } | null>(null);

  const friendships = useFeedntFriendships();
  const { ensureFriendshipsLoaded } = friendships;
  const identity = useIdentityDialog({
    keyId: keys.keyId,
    usernameByKeyId,
    usernames,
    addLocalUser,
    friendKeyIds: friendships.friendKeyIds,
    friendshipsLoading: friendships.friendshipsLoading,
    friendshipsError: friendships.friendshipsError,
    onFriendshipsChanged: () => friendships.refresh({ force: true }),
    onOpen: () => {
      void friendships.ensureFriendshipsLoaded();
    },
  });
  const recipients = useFeedntRecipients({
    viewerKeyId: keys.keyId,
    friends: friendships.friends,
    loadingFriends: friendships.friendshipsLoading,
    friendsError: friendships.friendshipsError,
  });
  const decrypt = useBackendDecrypt(keys);
  const {
    clear: clearDecrypt,
    mergeDecryptedComments,
    decryptDelivery,
    decryptComments,
    busyMessageId,
    decryptedMessages,
    messageErrors,
    decryptedCommentsByMessage,
    commentsErrors,
  } = decrypt;
  const share = useBackendShare(keys, keys.keyId);
  const {
    clearLastShare,
    clearError: clearShareError,
    busy: shareBusy,
    lastShare,
  } = share;
  const feedContext = useMemo(
    () => ({
      allDeliveries: feed.allDeliveries,
      manifestLookup: feed.manifestLookup,
    }),
    [feed.allDeliveries, feed.manifestLookup],
  );

  useEffect(() => {
    if (createMessageDialogOpen) {
      void ensureFriendshipsLoaded();
    }
  }, [createMessageDialogOpen, ensureFriendshipsLoaded]);

  const handleMessageInteract = useCallback((messageId: string) => {
    setLastInteractedMessageId(messageId);
  }, []);

  const handleToggleMessage = useCallback(
    (messageId: string) => {
      setLastInteractedMessageId(messageId);
      setExpandedMessageIds((current) => {
        const next = new Set(current);
        if (next.has(messageId)) {
          next.delete(messageId);
        } else {
          next.add(messageId);
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
    await reloadFeed();
  }, [clearDecrypt, keys.keyId, reloadFeed]);

  const handleSendSuccess = useCallback(async () => {
    if (keys.keyId) {
      await reloadFeed();
    }
  }, [keys.keyId, reloadFeed]);

  const handleMessageSent = useCallback((detail: { messageId: string }) => {
    setSentMessageNotice(detail);
  }, []);

  const handleCloseSentMessageNotice = useCallback(() => {
    setSentMessageNotice(null);
  }, []);

  const handleOpenShare = useCallback(
    (messageId: string) => {
      setLastInteractedMessageId(messageId);
      clearShareError();
      void ensureFriendshipsLoaded();
      setShareTargetMessageId(messageId);
      setShareDialogOpen(true);
    },
    [clearShareError, ensureFriendshipsLoaded],
  );

  const handleCloseShareDialog = useCallback(() => {
    setShareDialogOpen(false);
    setShareTargetMessageId(null);
    clearShareError();
  }, [clearShareError]);

  if (!session) {
    return null;
  }

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
          startIcon={
            feed.loading ? (
              <CircularProgress size={16} color="inherit" />
            ) : (
              <RefreshOutlinedIcon />
            )
          }
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

      {feed.error ? (
        <Typography color="error" variant="body2">
          {feed.error}
        </Typography>
      ) : null}

      <Stack spacing={1.5}>
        {feed.messages.map((message) => {
          const isExpanded = expandedMessageIds.has(message.id);
          const decryptedComments =
            decryptedCommentsByMessage[message.id] ?? null;
          return (
            <MessageThreadCard
              key={message.id}
              message={message}
              expanded={isExpanded}
              highlighted={lastInteractedMessageId === message.id}
              onMessageInteract={handleMessageInteract}
              onToggleMessage={handleToggleMessage}
              onDecryptDelivery={decryptDelivery}
              onDecryptComments={decryptComments}
              decryptBusy={busyMessageId === message.id}
              decryptError={messageErrors[message.id] ?? null}
              decryptCommentsError={commentsErrors[message.id] ?? null}
              decryptPlaintext={decryptedMessages[message.id] ?? null}
              decryptedComments={decryptedComments}
              shareBusy={shareBusy}
              shareLastShareId={
                isExpanded && lastShare?.messageId === message.id
                  ? lastShare.shareId
                  : null
              }
              onOpenShare={handleOpenShare}
              onMergeDecryptedComments={mergeDecryptedComments}
              feedContext={feedContext}
              usernameByKeyId={usernameByKeyId}
              viewerKeyId={keys.keyId}
              onOpenIdentity={identity.openIdentity}
            />
          );
        })}
        {keys.keyId && !feed.loading && feed.messages.length === 0 ? (
          <Typography color="text.secondary">
            No messages in your inbox yet.
          </Typography>
        ) : null}
      </Stack>

      <SendMessageDialog
        open={createMessageDialogOpen}
        keys={keys}
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
                await reloadFeed();
              }
              return shareId;
            })
        }
      />

      <IdentityDialog {...identity.dialogProps} />
    </>
  );
}
