import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { Button, Stack, Typography } from '@mui/material';
import SendOutlinedIcon from '@mui/icons-material/SendOutlined';
import { useBackendFeedData } from '@feednt/hooks/useBackendFeedData.ts';
import { useBackendDecrypt } from '@feednt/hooks/useBackendDecrypt.ts';
import { useVisibleFeedMessages } from '@feednt/hooks/useVisibleFeedMessages.ts';
import { useBackendShare } from '@feednt/hooks/useBackendShare.ts';
import { useFeedntFriendships } from '@feednt/providers/FeedntFriendshipsProvider.tsx';
import { useFeedntRecipients } from '@feednt/hooks/useFeedntRecipients.ts';
import { useIdentityDialog } from '@feednt/hooks/useIdentityDialog.ts';
import { IdentityDialog } from '@feednt/components/IdentityDialog.tsx';
import { MessageThreadCard } from '@feednt/components/MessageThreadCard.tsx';
import {
  FeedMessageEnter,
  FeedRefreshButtonIcon,
  ButtonIconSlot,
  feedActionButtonSx,
  MessageSentSnackbar,
  MessageSharedSnackbar,
  ShareMessageDialog,
  SendMessageDialog,
  useFeedMessageEnterState,
  useFeedRefreshFeedback,
  FeedNoFriendsGuide,
} from '@encrypt/ui';
import { useFeedntSession } from '@feednt/providers/FeedntSessionProvider.tsx';
import { useFeedntSettings } from '@feednt/providers/FeedntSettingsProvider.tsx';

export function FeedPage() {
  const { session, keys, feedntUsers } = useFeedntSession();
  const { usernameByKeyId, usernames, addLocalUser } = feedntUsers;
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
  const [messageSentNoticeKey, setMessageSentNoticeKey] = useState(0);
  const [messageSharedNoticeKey, setMessageSharedNoticeKey] = useState(0);

  const friendships = useFeedntFriendships();
  const { ensureFriendshipsLoaded } = friendships;
  const ensureFriendshipsLoadedRef = useRef(ensureFriendshipsLoaded);

  useEffect(() => {
    ensureFriendshipsLoadedRef.current = ensureFriendshipsLoaded;
  });

  const feed = useBackendFeedData(session?.keyId ?? null, {
    onEmptyInbox: () => void ensureFriendshipsLoadedRef.current(),
  });
  const { reload: reloadFeed } = feed;
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
  const { automateDecryption } = useFeedntSettings();
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
    automateDecryption,
    decryptDeliveries,
    feedContext,
  });
  const feedBusy = feed.loading || preparingFeed;
  const inboxIsEmpty =
    keys.keyId != null &&
    !feed.loading &&
    !feed.error &&
    !feed.notRegistered &&
    feed.messages.length === 0;
  const showOnboardingGuide =
    feed.notRegistered || (inboxIsEmpty && friendships.friends.length === 0);
  const loadMorePreparing = preparingFeed && visibleMessages.length > 0;
  const showLoadMore =
    feed.hasMore && (feed.loadingMore || loadMorePreparing || !feedBusy);
  const loadMoreBusy = feed.loadingMore || loadMorePreparing;
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
    if (wasLoading && !feed.loading && !automateDecryption) {
      clearDecrypt();
    }
  }, [automateDecryption, clearDecrypt, feed.loading]);

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

  const handleMessageSent = useCallback(() => {
    setMessageSentNoticeKey((current) => current + 1);
  }, []);

  const handleCloseMessageSentNotice = useCallback(() => {
    setMessageSentNoticeKey(0);
  }, []);

  const handleMessageShared = useCallback(() => {
    setMessageSharedNoticeKey((current) => current + 1);
  }, []);

  const handleCloseMessageSharedNotice = useCallback(() => {
    setMessageSharedNoticeKey(0);
  }, []);

  const handleOpenShare = useCallback(
    (messageId: string) => {
      if (feed.notRegistered) {
        return;
      }
      setLastInteractedMessageId(messageId);
      clearShareError();
      void ensureFriendshipsLoaded();
      setShareTargetMessageId(messageId);
      setShareDialogOpen(true);
    },
    [clearShareError, ensureFriendshipsLoaded, feed.notRegistered],
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
          data-testid="feed-create-message"
          variant="contained"
          size="small"
          sx={feedActionButtonSx}
          startIcon={
            <ButtonIconSlot>
              <SendOutlinedIcon />
            </ButtonIconSlot>
          }
          disabled={!keys.keyId || feed.notRegistered}
          onClick={() => setCreateMessageDialogOpen(true)}
        >
          Create message
        </Button>
      </Stack>

      {showOnboardingGuide ? (
        <FeedNoFriendsGuide
          loading={friendships.friendshipsLoading && !feed.notRegistered}
          error={feed.notRegistered ? null : friendships.friendshipsError}
        />
      ) : null}

      {feed.error && !feed.notRegistered ? (
        <Typography color="error" variant="body2">
          {feed.error}
        </Typography>
      ) : null}

      <Stack spacing={2} sx={{ width: '100%', ...feedListPulseSx }}>
        {visibleMessages.map((message) => {
          const isExpanded = expandedMessageIds.has(message.id);
          const decryptedComments =
            decryptedCommentsByMessage[message.id] ?? null;
          const animateEntry =
            shouldAnimateEntry(message.id) &&
            !feed.loadedMoreMessageIds.has(message.id);
          return (
            <FeedMessageEnter
              key={message.id}
              messageId={message.id}
              animateEntry={animateEntry}
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
            No messages in your inbox yet.
          </Typography>
        ) : null}
        {showLoadMore ? (
          <Button
            variant="outlined"
            sx={{ ...feedActionButtonSx }}
            disabled={loadMoreBusy}
            onClick={() => void feed.loadMore()}
          >
            {loadMoreBusy ? 'Loading...' : 'Load more'}
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
        noticeKey={messageSentNoticeKey}
        onClose={handleCloseMessageSentNotice}
      />

      <MessageSharedSnackbar
        noticeKey={messageSharedNoticeKey}
        onClose={handleCloseMessageSharedNotice}
      />

      <ShareMessageDialog
        open={shareDialogOpen}
        messageId={shareTargetMessageId}
        busy={share.busy}
        error={share.error}
        recipients={recipients.recipients}
        loadingRecipients={
          recipients.loadingFriends || recipients.loadingRecipientKeys
        }
        recipientsError={recipients.error}
        hasFriends={recipients.recipientOptions.length > 0}
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
            .then((shareId) => {
              if (shareId) {
                handleMessageShared();
              }
              return shareId;
            })
        }
      />

      <IdentityDialog {...identity.dialogProps} />
    </>
  );
}
