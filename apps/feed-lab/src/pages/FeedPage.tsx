import React, {
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
} from 'react';
import { Button, Stack, Typography } from '@mui/material';
import SendOutlinedIcon from '@mui/icons-material/SendOutlined';
import { useBackendFeedData } from '@lab/hooks/useBackendFeedData.ts';
import { useBackendDecrypt } from '@lab/hooks/useBackendDecrypt.ts';
import { useVisibleFeedMessages } from '@lab/hooks/useVisibleFeedMessages.ts';
import { useBackendShare } from '@lab/hooks/useBackendShare.ts';
import { useFeedLabFriendships } from '@lab/providers/FeedLabFriendshipsProvider.tsx';
import { useFeedLabRecipients } from '@lab/hooks/useFeedLabRecipients.ts';
import { useIdentityDialog } from '@lab/hooks/useIdentityDialog.ts';
import { IdentityDialog } from '@lab/components/IdentityDialog.tsx';
import { MessageThreadCard } from '@lab/components/MessageThreadCard.tsx';
import {
  FeedMessageEnter,
  FeedBusyButtonIcon,
  FeedRefreshButtonIcon,
  ButtonIconSlot,
  feedActionButtonSx,
  useFeedMessageEnterState,
  useFeedRefreshFeedback,
} from '@encrypt/ui';
import { MessageSentSnackbar } from '@lab/components/MessageSentSnackbar.tsx';
import { SendMessageDialog } from '@lab/components/SendMessageDialog.tsx';
import { ShareMessageDialog } from '@lab/components/ShareMessageDialog.tsx';
import { useFeedLabSession } from '@lab/providers/FeedLabSessionProvider.tsx';
import { useFeedLabSettings } from '@lab/providers/FeedLabSettingsProvider.tsx';
import { cancelPendingSystemOps } from '@lab/crypto/systemAppSigner.ts';

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

  const friendships = useFeedLabFriendships();
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
  const recipients = useFeedLabRecipients({
    viewerKeyId: keys.keyId,
    friends: friendships.friends,
    loadingFriends: friendships.friendshipsLoading,
    friendsError: friendships.friendshipsError,
  });
  const { automateDecryption } = useFeedLabSettings();
  const autoDecryptEnabled = automateDecryption && !keys.isSystemAppSession;
  const decrypt = useBackendDecrypt(keys);
  const {
    clear: clearDecrypt,
    mergeDecryptedComments,
    decryptDelivery,
    decryptDeliveries,
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
  const { visibleMessages, preparing: preparingFeed } = useVisibleFeedMessages({
    messages: feed.messages,
    feedLoading: feed.loading,
    automateDecryption: autoDecryptEnabled,
    decryptDeliveries,
    feedContext,
  });
  const feedBusy = feed.loading || preparingFeed;
  const visibleMessageIds = useMemo(
    () => visibleMessages.map((message) => message.id),
    [visibleMessages],
  );
  const { shouldAnimateEntry, onAnimationDone, getStaggerIndex } =
    useFeedMessageEnterState();
  const { showRefreshSuccess, markRefreshStarted, feedListPulseSx } =
    useFeedRefreshFeedback({
      feedBusy,
      feedError: feed.error,
    });

  const wasFeedLoadingRef = useRef(feed.loading);
  useEffect(() => {
    const wasLoading = wasFeedLoadingRef.current;
    wasFeedLoadingRef.current = feed.loading;
    if (wasLoading && !feed.loading && !autoDecryptEnabled) {
      clearDecrypt();
    }
  }, [autoDecryptEnabled, clearDecrypt, feed.loading]);

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
          cancelPendingSystemOps();
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
    markRefreshStarted();
    setExpandedMessageIds(new Set());
    clearLastShare();
    await reloadFeed();
  }, [clearLastShare, keys.keyId, markRefreshStarted, reloadFeed]);

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
          sx={feedActionButtonSx}
          startIcon={
            <FeedRefreshButtonIcon
              busy={feedBusy}
              success={showRefreshSuccess}
            />
          }
          disabled={!keys.keyId || feedBusy}
          onClick={() => void handleReloadFeed()}
        >
          Refresh feed
        </Button>
        <Button
          variant="contained"
          size="small"
          sx={feedActionButtonSx}
          startIcon={
            <ButtonIconSlot>
              <SendOutlinedIcon />
            </ButtonIconSlot>
          }
          disabled={!keys.keyId}
          onClick={() => setCreateMessageDialogOpen(true)}
        >
          Create message
        </Button>
      </Stack>

      <Stack spacing={2} sx={{ width: '100%', ...feedListPulseSx }}>
        {visibleMessages.map((message) => {
          const isExpanded = expandedMessageIds.has(message.id);
          const decryptedComments =
            decryptedCommentsByMessage[message.id] ?? null;
          return (
            <FeedMessageEnter
              key={message.id}
              messageId={message.id}
              animateEntry={shouldAnimateEntry(message.id)}
              staggerIndex={getStaggerIndex(message.id, visibleMessageIds)}
              onAnimationDone={onAnimationDone}
            >
              <MessageThreadCard
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
            </FeedMessageEnter>
          );
        })}
        {keys.keyId && !feedBusy && visibleMessages.length === 0 ? (
          <Typography color="text.secondary">
            No data yet for this keyId.
          </Typography>
        ) : null}
        {feed.hasMore && (feed.loadingMore || !feedBusy) ? (
          <Button
            variant="outlined"
            size="small"
            sx={feedActionButtonSx}
            disabled={feed.loadingMore}
            startIcon={feed.loadingMore ? <FeedBusyButtonIcon /> : undefined}
            onClick={() => void feed.loadMore()}
          >
            Load more
          </Button>
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
