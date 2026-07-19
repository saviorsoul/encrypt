import React, { useCallback, useMemo, useState } from 'react';
import { Button, CircularProgress, Stack, Typography } from '@mui/material';
import RefreshOutlinedIcon from '@mui/icons-material/RefreshOutlined';
import SendOutlinedIcon from '@mui/icons-material/SendOutlined';
import { useBackendFeedData } from '@lab/hooks/useBackendFeedData.ts';
import { useBackendDecrypt } from '@lab/hooks/useBackendDecrypt.ts';
import { useBackendShare } from '@lab/hooks/useBackendShare.ts';
import { useFeedLabFriendships } from '@lab/hooks/useFeedLabFriendships.ts';
import { useFeedLabRecipients } from '@lab/hooks/useFeedLabRecipients.ts';
import { useIdentityDialog } from '@lab/hooks/useIdentityDialog.ts';
import { IdentityDialog } from '@lab/components/IdentityDialog.tsx';
import { MessageThreadCard } from '@lab/components/MessageThreadCard.tsx';
import { MessageSentSnackbar } from '@lab/components/MessageSentSnackbar.tsx';
import { SendMessageDialog } from '@lab/components/SendMessageDialog.tsx';
import { ShareMessageDialog } from '@lab/components/ShareMessageDialog.tsx';
import { useFeedLabSession } from '@lab/providers/FeedLabSessionProvider.tsx';

export function FeedPage() {
  const { keys, feedLabUsers } = useFeedLabSession();
  const { usernameByKeyId, usernames, addLocalUser } = feedLabUsers;
  const feed = useBackendFeedData(keys.keyId);
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

  const friendships = useFeedLabFriendships(
    keys.keyId,
    usernameByKeyId,
    addLocalUser,
  );
  const identity = useIdentityDialog({
    keyId: keys.keyId,
    usernameByKeyId,
    usernames,
    addLocalUser,
    friendKeyIds: friendships.friendKeyIds,
    onFriendshipsChanged: friendships.refresh,
  });
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
  const feedContext = useMemo(
    () => ({
      allDeliveries: feed.allDeliveries,
      manifestLookup: feed.manifestLookup,
    }),
    [feed.allDeliveries, feed.manifestLookup],
  );

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
              decryptCommentsBusy={busyCommentsMessageId === message.id}
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
