import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import type { FeedMessageSortMode } from '@encrypt/core/feed/types';
import type { StoredMessage } from '@encrypt/core/feed/types';
import { useLocation, useNavigate, useParams } from 'react-router-dom';
import { Box, Button, Stack, Typography } from '@mui/material';
import SendOutlinedIcon from '@mui/icons-material/SendOutlined';
import { useBackendFeedData } from '@feednt/hooks/useBackendFeedData.ts';
import { useBackendDecrypt } from '@feednt/hooks/useBackendDecrypt.ts';
import { useVisibleFeedMessages } from '@feednt/hooks/useVisibleFeedMessages.ts';
import { useBackendShare } from '@feednt/hooks/useBackendShare.ts';
import { useFeedntFriendships } from '@feednt/providers/FeedntFriendshipsProvider.tsx';
import { useFeedntRecipients } from '@feednt/hooks/useFeedntRecipients.ts';
import { MessageThreadCard } from '@feednt/components/MessageThreadCard.tsx';
import {
  FeedRefreshButtonIcon,
  ButtonIconSlot,
  feedActionButtonSx,
  MessageSentSnackbar,
  MessageSharedSnackbar,
  ShareMessageDialog,
  SendMessageDialog,
  useFeedMessageEnterState,
  useFeedRefreshFeedback,
  useFeedMessageSort,
  FeedMessageSortButton,
  FeedPullToRefresh,
  FeedRefreshPulseOverlay,
  FeedLoadMoreButton,
  FeedMessageList,
  useFeedPullToRefreshEnabled,
  useFeedReloadAction,
  FeedNoFriendsGuide,
  AcceptInvitationDialog,
  useCreateMessageRecipientsLoading,
  isFeedInvitationalOnlyEnabled,
  IdentityDialog,
  useIdentityDialog,
} from '@encrypt/ui';
import { saveFeedntUser } from '@feednt/services/db/storedUsers.ts';
import { FeedntInvitationQrScan } from '@feednt/components/FeedntInvitationQrScan.tsx';
import { useFeedntSession } from '@feednt/providers/FeedntSessionProvider.tsx';
import { useFeedntSettings } from '@feednt/providers/FeedntSettingsProvider.tsx';
import { AddFriendDialog } from '@feednt/components/AddFriendDialog.tsx';
import { useBackendFriendInvitations } from '@feednt/hooks/useBackendFriendInvitations.ts';
import { useBackendFriendshipRequests } from '@feednt/hooks/useBackendFriendshipRequests.ts';
import { formatEcPublicKeyText } from '@encrypt/core/crypto/ecPublicKey';
import { isUnknownUserKeyIdError } from '@encrypt/core/utils/apiRegistrationError';
import { isCapacitorApp } from '@encrypt/platform/isCapacitorApp';

function createMessageDialogOpenFromPathname(pathname: string): boolean {
  return pathname.startsWith('/create-message');
}

export function FeedPage() {
  const location = useLocation();
  const navigate = useNavigate();
  const { messageId: shareMessageId } = useParams<{ messageId?: string }>();
  const createMessageDialogOpen = createMessageDialogOpenFromPathname(
    location.pathname,
  );
  const shareDialogOpen = shareMessageId != null;
  const { session, keys, feedntUsers } = useFeedntSession();
  const { usernameByKeyId, usernames, addLocalUser } = feedntUsers;
  const [expandedMessageIds, setExpandedMessageIds] = useState<Set<string>>(
    () => new Set(),
  );
  const [instantCollapseTransition, setInstantCollapseTransition] =
    useState(false);
  const [lastInteractedMessageId, setLastInteractedMessageId] = useState<
    string | null
  >(null);
  const [messageSentNoticeKey, setMessageSentNoticeKey] = useState(0);
  const [messageSharedNoticeKey, setMessageSharedNoticeKey] = useState(0);
  const [acceptInvitationOpen, setAcceptInvitationOpen] = useState(false);
  const [qrScanOpen, setQrScanOpen] = useState(false);
  const [addFriendDialogOpen, setAddFriendDialogOpen] = useState(false);
  const feedInvitationalOnly = isFeedInvitationalOnlyEnabled();

  const friendships = useFeedntFriendships();
  const refreshFriendData = useCallback(async () => {
    await friendships.refresh({ force: true });
  }, [friendships]);
  const friendInvitations = useBackendFriendInvitations(refreshFriendData);
  const friendshipRequests = useBackendFriendshipRequests(
    refreshFriendData,
    addLocalUser,
  );
  const isRegistered =
    keys.keyId != null &&
    (!feedInvitationalOnly ||
      !(
        friendships.friendshipsError &&
        isUnknownUserKeyIdError(friendships.friendshipsError, keys.keyId)
      ));
  const { ensureFriendshipsLoaded } = friendships;
  const ensureFriendshipsLoadedRef = useRef(ensureFriendshipsLoaded);

  useEffect(() => {
    ensureFriendshipsLoadedRef.current = ensureFriendshipsLoaded;
  });

  const { sortMode, setSortMode } = useFeedMessageSort();
  const feed = useBackendFeedData(session?.keyId ?? null, {
    onEmptyInbox: () => void ensureFriendshipsLoadedRef.current(),
    sort: sortMode,
  });
  const { reload: reloadFeed } = feed;
  const identity = useIdentityDialog({
    keyId: keys.keyId,
    usernameByKeyId,
    addLocalUser,
    friendKeyIds: friendships.friendKeyIds,
    saveLocalUser: async (ownerKeyId, username, publicKey) => {
      await saveFeedntUser(ownerKeyId, username, {
        kty: 'EC',
        crv: 'P-256',
        x: publicKey.x,
        y: publicKey.y,
      });
    },
    friendshipsLoading: friendships.friendshipsLoading,
    friendshipsError: friendships.friendshipsError,
    busy: friendshipRequests.busy,
    error: friendshipRequests.error,
    info: friendshipRequests.info,
    onClearError: friendshipRequests.clearError,
    onCancelInFlight: friendshipRequests.cancelInFlight,
    onOpenIdentity: () => {
      friendshipRequests.clearError();
      friendshipRequests.clearInfo();
      void friendships.ensureFriendshipsLoaded();
    },
    onCloseIdentity: () => {
      friendshipRequests.cancelInFlight();
    },
    onAddFriend: async (name, target) => {
      if (!keys.keyId) {
        return { ok: false };
      }
      return friendshipRequests.sendRequestByPublicKey(
        keys.keyId,
        formatEcPublicKeyText(target.publicKey),
        name,
        usernames,
        usernameByKeyId,
      );
    },
    getFriendMute: friendships.getFriendMute,
    onToggleFriendMute: friendships.toggleFriendDeliveryMute,
  });
  const recipients = useFeedntRecipients({
    viewerKeyId: keys.keyId,
    friends: friendships.friends,
    loadingFriends: friendships.friendshipsLoading,
    friendsError: friendships.friendshipsError,
  });
  const createMessageRecipientsLoading = useCreateMessageRecipientsLoading(
    createMessageDialogOpen,
    ensureFriendshipsLoaded,
    recipients,
  );
  const createMessageRecipients = useMemo(
    () => ({
      ...recipients,
      loadingFriends: createMessageRecipientsLoading.loadingFriends,
      loadingRecipientKeys: createMessageRecipientsLoading.loadingRecipientKeys,
    }),
    [createMessageRecipientsLoading, recipients],
  );
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
  const handleCommentPosted = useCallback(
    (messageId: string, createdAt: number) => {
      feed.bumpLastCommentAt(messageId, createdAt);
      if (sortMode === 'lastComment') {
        void reloadFeed();
      }
    },
    [feed, reloadFeed, sortMode],
  );
  const inboxIsEmpty =
    keys.keyId != null &&
    !feed.loading &&
    !feed.error &&
    !feed.notRegistered &&
    feed.messages.length === 0;
  const showOnboardingGuide =
    (feedInvitationalOnly && feed.notRegistered) ||
    (inboxIsEmpty && friendships.friends.length === 0);
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
  const { isFeedPulsing, markRefreshStarted } = useFeedRefreshFeedback({
    feedBusy,
    feedError: feed.error,
  });
  const pullToRefreshEnabled = useFeedPullToRefreshEnabled(isCapacitorApp());
  const handleSortModeChange = useCallback(
    (mode: FeedMessageSortMode) => {
      if (mode === sortMode) {
        return;
      }
      markRefreshStarted();
      setInstantCollapseTransition(true);
      setExpandedMessageIds(new Set());
      clearLastShare();
      setSortMode(mode);
      queueMicrotask(() => {
        setInstantCollapseTransition(false);
      });
    },
    [clearLastShare, markRefreshStarted, setSortMode, sortMode],
  );

  const wasFeedLoadingRef = useRef(feed.loading);

  useEffect(() => {
    const wasLoading = wasFeedLoadingRef.current;
    wasFeedLoadingRef.current = feed.loading;
    if (wasLoading && !feed.loading && !automateDecryption) {
      clearDecrypt();
    }
  }, [automateDecryption, clearDecrypt, feed.loading]);

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

  const prepareFeedReload = useCallback(() => {
    clearLastShare();
  }, [clearLastShare]);

  const handleReloadFeed = useFeedReloadAction({
    keyId: keys.keyId,
    markRefreshStarted,
    onPrepareReload: prepareFeedReload,
    reloadFeed,
  });

  const openCreateMessageDialog = useCallback(() => {
    navigate('/create-message');
  }, [navigate]);

  const closeCreateMessageDialog = useCallback(() => {
    navigate('/feed');
  }, [navigate]);

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

  useEffect(() => {
    if (!shareMessageId) {
      return;
    }
    clearShareError();
    void ensureFriendshipsLoaded();
  }, [clearShareError, ensureFriendshipsLoaded, shareMessageId]);

  const handleOpenShare = useCallback(
    (messageId: string) => {
      if (feedInvitationalOnly && feed.notRegistered) {
        return;
      }
      setLastInteractedMessageId(messageId);
      navigate(`/share/${encodeURIComponent(messageId)}`);
    },
    [feed.notRegistered, feedInvitationalOnly, navigate],
  );

  const handleCloseShareDialog = useCallback(() => {
    navigate('/feed');
  }, [navigate]);

  const handleQrTokenScanned = useCallback(
    (token: string) => {
      setQrScanOpen(false);
      navigate(`/invite/${encodeURIComponent(token)}`);
    },
    [navigate],
  );

  const handleQrScanRequest = useCallback(() => {
    setAcceptInvitationOpen(false);
    setQrScanOpen(true);
  }, []);

  const handleInvitationIdSubmit = useCallback(
    (token: string) => {
      setAcceptInvitationOpen(false);
      navigate(`/invite/${encodeURIComponent(token)}`);
    },
    [navigate],
  );

  const openAddFriendDialog = useCallback(() => {
    friendInvitations.clearError();
    friendInvitations.clearLastInvitationId();
    friendshipRequests.clearError();
    friendshipRequests.clearInfo();
    setAddFriendDialogOpen(true);
  }, [friendInvitations, friendshipRequests]);

  const handleSendRequestByPublicKey = useCallback(
    async (publicKeyText: string, name: string) => {
      if (!keys.keyId) {
        return { ok: false };
      }
      return friendshipRequests.sendRequestByPublicKey(
        keys.keyId,
        publicKeyText,
        name,
        usernames,
        usernameByKeyId,
      );
    },
    [friendshipRequests, keys.keyId, usernameByKeyId, usernames],
  );

  const highlightedMessageId = shareMessageId ?? lastInteractedMessageId;

  const renderFeedMessage = useCallback(
    (message: StoredMessage) => {
      const isExpanded = expandedMessageIds.has(message.id);
      const decryptedComments = decryptedCommentsByMessage[message.id] ?? null;

      return (
        <MessageThreadCard
          message={message}
          expanded={isExpanded}
          highlighted={highlightedMessageId === message.id}
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
          getFriendMute={friendships.getFriendMute}
          onOpenIdentity={identity.openIdentity}
          onCommentPosted={handleCommentPosted}
          instantCollapseTransition={instantCollapseTransition}
        />
      );
    },
    [
      busyMessageId,
      commentsErrors,
      decryptComments,
      decryptDelivery,
      decryptedCommentsByMessage,
      decryptedMessages,
      expandedMessageIds,
      feedContext,
      friendships.getFriendMute,
      handleCommentPosted,
      handleMessageInteract,
      handleOpenShare,
      handleToggleMessage,
      identity.openIdentity,
      instantCollapseTransition,
      keys.keyId,
      highlightedMessageId,
      lastShare,
      mergeDecryptedComments,
      messageErrors,
      shareBusy,
      usernameByKeyId,
    ],
  );

  if (!session) {
    return null;
  }

  return (
    <>
      <FeedPullToRefresh
        enabled={pullToRefreshEnabled}
        disabled={!keys.keyId}
        busy={feedBusy}
        onRefresh={handleReloadFeed}
      />
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
          startIcon={<FeedRefreshButtonIcon busy={feedBusy} />}
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
          disabled={!keys.keyId || (feedInvitationalOnly && feed.notRegistered)}
          onClick={openCreateMessageDialog}
        >
          Create message
        </Button>
        <Box sx={{ ml: 'auto' }}>
          <FeedMessageSortButton
            sortMode={sortMode}
            onSortModeChange={handleSortModeChange}
            disabled={!keys.keyId || feedBusy}
          />
        </Box>
      </Stack>

      {showOnboardingGuide ? (
        <FeedNoFriendsGuide
          invitationalOnly={feedInvitationalOnly}
          loading={
            feedInvitationalOnly && feed.notRegistered
              ? feed.loading
              : friendships.friendshipsLoading
          }
          error={
            feedInvitationalOnly && feed.notRegistered
              ? null
              : friendships.friendshipsError
          }
          onAcceptInvite={() => setAcceptInvitationOpen(true)}
          acceptInviteDisabled={!keys.keyId}
          onInviteFriend={
            feedInvitationalOnly ? undefined : openAddFriendDialog
          }
          inviteFriendDisabled={
            !keys.keyId ||
            friendships.usersLoading ||
            friendInvitations.busy ||
            !isRegistered
          }
        />
      ) : null}

      {feed.error && !(feedInvitationalOnly && feed.notRegistered) ? (
        <Typography color="error" variant="body2">
          {feed.error}
        </Typography>
      ) : null}

      <Box sx={{ position: 'relative', width: '100%' }}>
        <FeedRefreshPulseOverlay active={isFeedPulsing} />
        <Stack spacing={2} sx={{ width: '100%' }}>
          <FeedMessageList
            messages={visibleMessages}
            loadedMoreMessageIds={feed.loadedMoreMessageIds}
            visibleMessageIds={visibleMessageIds}
            shouldAnimateEntry={shouldAnimateEntry}
            getStaggerIndex={getStaggerIndex}
            onAnimationDone={onAnimationDone}
            renderMessage={renderFeedMessage}
          />
          {keys.keyId && !feedBusy && visibleMessages.length === 0 ? (
            <Typography color="text.secondary">
              No messages in your inbox yet.
            </Typography>
          ) : null}
          {showLoadMore ? (
            <FeedLoadMoreButton
              busy={loadMoreBusy}
              onLoadMore={feed.loadMore}
            />
          ) : null}
        </Stack>
      </Box>

      <SendMessageDialog
        open={createMessageDialogOpen}
        keys={keys}
        recipients={createMessageRecipients}
        onClose={closeCreateMessageDialog}
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
        messageId={shareMessageId ?? null}
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
              messageId: shareMessageId ?? '',
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

      <AddFriendDialog
        open={addFriendDialogOpen}
        authenticated={keys.keyId != null}
        isRegistered={isRegistered}
        hasFriends={friendships.friends.length > 0}
        invitationBusy={friendInvitations.busy}
        invitationError={friendInvitations.error}
        invitationId={friendInvitations.lastInvitationId}
        requestBusy={friendshipRequests.busy}
        requestError={friendshipRequests.error}
        requestInfo={friendshipRequests.info}
        onClose={() => setAddFriendDialogOpen(false)}
        onClearInvitationError={friendInvitations.clearError}
        onClearRequestError={friendshipRequests.clearError}
        onCancelInFlight={friendshipRequests.cancelInFlight}
        onCreateInvitation={(name) =>
          void friendInvitations.createInvitation(name)
        }
        onSendRequestByPublicKey={handleSendRequestByPublicKey}
      />

      <AcceptInvitationDialog
        open={acceptInvitationOpen}
        onClose={() => setAcceptInvitationOpen(false)}
        onSubmit={handleInvitationIdSubmit}
        qrScanAvailable
        onQrScanRequest={handleQrScanRequest}
      />

      <FeedntInvitationQrScan
        open={qrScanOpen}
        onClose={() => setQrScanOpen(false)}
        onTokenScanned={handleQrTokenScanned}
      />
    </>
  );
}
