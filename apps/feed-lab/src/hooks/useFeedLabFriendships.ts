import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import type {
  Friendship,
  FriendshipRequest,
  FriendInvitation,
} from '@encrypt/core/api/feedApi';
import { useFeedApi } from '@lab/providers/FeedApiProvider.tsx';
import { friendshipRequestErrorMessage } from '@lab/lib/friendshipRequestErrors.ts';
import { buildFeedLabInvitationHref } from '@lab/lib/invitationHref.ts';
import { buildSentInvitationLabelByToken } from '@lab/services/db/sentInvitations.ts';
import { saveFeedLabUser } from '@lab/services/db/storedUsers.ts';
import {
  USERS_DRAWER_LOADING_MIN_MS,
  waitForMinDuration,
} from '@lab/lib/usersDrawerTiming.ts';
import {
  cacheHasFriendships,
  cacheHasUsersData,
  getFriendshipsCache,
  setFriendshipsCache,
  type PendingInvitationLink,
} from '@lab/services/friendshipsCache.ts';

export type FeedLabFriend = {
  keyId: string;
  label: string;
  publicKey: { x: string; y: string };
};

export type RefreshFriendshipsOptions = {
  force?: boolean;
};

export type FeedLabFriendshipsValue = {
  friends: FeedLabFriend[];
  friendKeyIds: string[];
  friendLabels: string[];
  invitationLabelByToken: Record<string, string>;
  incomingRequests: FriendshipRequest[];
  outgoingRequests: FriendshipRequest[];
  pendingInvitations: PendingInvitationLink[];
  friendshipsLoading: boolean;
  friendshipsError: string | null;
  usersLoading: boolean;
  usersError: string | null;
  ensureFriendshipsLoaded: (
    refreshOptions?: RefreshFriendshipsOptions,
  ) => Promise<void>;
  ensureUsersLoaded: (
    refreshOptions?: RefreshFriendshipsOptions,
  ) => Promise<void>;
  refresh: (refreshOptions?: RefreshFriendshipsOptions) => Promise<void>;
  updateInvitationLabel: (token: string, label: string) => void;
};

function labelForFriend(
  friendKeyId: string,
  usernameByKeyId: Record<string, string>,
  invitationToken: string | null | undefined,
  invitationLabelByToken: Record<string, string>,
): string {
  const storedUsername = usernameByKeyId[friendKeyId];
  if (storedUsername) {
    return storedUsername;
  }

  if (invitationToken) {
    const invitationLabel = invitationLabelByToken[invitationToken]?.trim();
    if (invitationLabel) {
      return invitationLabel;
    }
  }

  return friendKeyId;
}

function mapFriendshipsToFriends(
  friendships: Friendship[],
  usernameByKeyId: Record<string, string>,
  invitationLabelByToken: Record<string, string>,
): FeedLabFriend[] {
  return friendships.map((friendship) => ({
    keyId: friendship.friendKeyId,
    label: labelForFriend(
      friendship.friendKeyId,
      usernameByKeyId,
      friendship.invitationToken,
      invitationLabelByToken,
    ),
    publicKey: friendship.publicKey,
  }));
}

function buildPendingInvitationLinks(
  pending: FriendInvitation[],
  labelByToken: Record<string, string>,
): PendingInvitationLink[] {
  return pending
    .filter((invitation) => invitation.status === 'pending')
    .map((invitation) => ({
      token: invitation.token,
      href: buildFeedLabInvitationHref(invitation.token),
      label: labelByToken[invitation.token]?.trim() || null,
      createdAt: invitation.createdAt,
    }));
}

function applyFriendshipsCache(
  cached: NonNullable<ReturnType<typeof getFriendshipsCache>>,
  setRawFriendships: (friendships: Friendship[]) => void,
  setInvitationLabelByToken: (labels: Record<string, string>) => void,
): void {
  setRawFriendships(cached.friendships);
  setInvitationLabelByToken(cached.invitationLabelByToken);
}

function applyUsersCache(
  cached: NonNullable<ReturnType<typeof getFriendshipsCache>>,
  setIncomingRequests: (requests: FriendshipRequest[]) => void,
  setOutgoingRequests: (requests: FriendshipRequest[]) => void,
  setPendingInvitations: (invitations: PendingInvitationLink[]) => void,
): void {
  setIncomingRequests(cached.incomingRequests);
  setOutgoingRequests(cached.outgoingRequests);
  setPendingInvitations(cached.pendingInvitations);
}

function applyFullCache(
  cached: NonNullable<ReturnType<typeof getFriendshipsCache>>,
  setRawFriendships: (friendships: Friendship[]) => void,
  setInvitationLabelByToken: (labels: Record<string, string>) => void,
  setIncomingRequests: (requests: FriendshipRequest[]) => void,
  setOutgoingRequests: (requests: FriendshipRequest[]) => void,
  setPendingInvitations: (invitations: PendingInvitationLink[]) => void,
): void {
  applyFriendshipsCache(cached, setRawFriendships, setInvitationLabelByToken);
  applyUsersCache(
    cached,
    setIncomingRequests,
    setOutgoingRequests,
    setPendingInvitations,
  );
}

export function useFeedLabFriendshipsState(
  ownerKeyId: string | null,
  usernameByKeyId: Record<string, string>,
  addLocalUser?: (input: { keyId: string; username: string }) => void,
): FeedLabFriendshipsValue {
  const api = useFeedApi();
  const [rawFriendships, setRawFriendships] = useState<Friendship[]>([]);
  const [invitationLabelByToken, setInvitationLabelByToken] = useState<
    Record<string, string>
  >({});
  const [incomingRequests, setIncomingRequests] = useState<FriendshipRequest[]>(
    [],
  );
  const [outgoingRequests, setOutgoingRequests] = useState<FriendshipRequest[]>(
    [],
  );
  const [pendingInvitations, setPendingInvitations] = useState<
    PendingInvitationLink[]
  >([]);
  const [friendshipsLoading, setFriendshipsLoading] = useState(false);
  const [friendshipsError, setFriendshipsError] = useState<string | null>(null);
  const [usersLoading, setUsersLoading] = useState(false);
  const [usersError, setUsersError] = useState<string | null>(null);
  const friendshipsInflightRef = useRef(false);
  const usersInflightRef = useRef<Promise<void> | null>(null);

  const ensureFriendshipsLoaded = useCallback(
    async (refreshOptions?: RefreshFriendshipsOptions) => {
      if (!ownerKeyId) {
        setRawFriendships([]);
        setInvitationLabelByToken({});
        setFriendshipsError(null);
        return;
      }

      const force = refreshOptions?.force === true;
      const cached = getFriendshipsCache(ownerKeyId);
      if (!force) {
        if (cacheHasFriendships(cached)) {
          applyFriendshipsCache(
            cached,
            setRawFriendships,
            setInvitationLabelByToken,
          );
          setFriendshipsError(null);
          return;
        }
      }

      if (friendshipsInflightRef.current) {
        return;
      }

      friendshipsInflightRef.current = true;
      setFriendshipsLoading(true);
      setFriendshipsError(null);
      try {
        const [friendships, labels] = await Promise.all([
          api.getFriendships(),
          buildSentInvitationLabelByToken(ownerKeyId),
        ]);
        setFriendshipsCache(ownerKeyId, {
          friendships,
          invitationLabelByToken: labels,
          incomingRequests: cached?.incomingRequests ?? [],
          outgoingRequests: cached?.outgoingRequests ?? [],
          pendingInvitations: cached?.pendingInvitations ?? [],
          hasFriendships: true,
          hasUsersData: cached?.hasUsersData ?? false,
        });
        setRawFriendships(friendships);
        setInvitationLabelByToken(labels);
      } catch (e) {
        const message = friendshipRequestErrorMessage(e);
        if (cached && cacheHasFriendships(cached)) {
          applyFriendshipsCache(
            cached,
            setRawFriendships,
            setInvitationLabelByToken,
          );
        } else {
          setRawFriendships([]);
          setInvitationLabelByToken({});
        }
        setFriendshipsError(message);
      } finally {
        friendshipsInflightRef.current = false;
        setFriendshipsLoading(false);
      }
    },
    [api, ownerKeyId],
  );

  const ensureUsersLoaded = useCallback(
    async (refreshOptions?: RefreshFriendshipsOptions) => {
      if (!ownerKeyId) {
        setRawFriendships([]);
        setInvitationLabelByToken({});
        setIncomingRequests([]);
        setOutgoingRequests([]);
        setPendingInvitations([]);
        setFriendshipsError(null);
        setUsersError(null);
        return;
      }

      if (usersInflightRef.current) {
        return usersInflightRef.current;
      }

      const loadUsers = async () => {
        const force = refreshOptions?.force === true;
        const cached = getFriendshipsCache(ownerKeyId);
        if (!force) {
          if (cacheHasUsersData(cached)) {
            applyFullCache(
              cached,
              setRawFriendships,
              setInvitationLabelByToken,
              setIncomingRequests,
              setOutgoingRequests,
              setPendingInvitations,
            );
            setFriendshipsError(null);
            setUsersError(null);
            return;
          }
        }

        const startedAt = Date.now();
        setUsersLoading(true);
        setUsersError(null);
        try {
          const needsFriendships = force || !cacheHasFriendships(cached);
          const labels = needsFriendships
            ? await buildSentInvitationLabelByToken(ownerKeyId)
            : cached!.invitationLabelByToken;
          const friendships = needsFriendships
            ? await api.getFriendships()
            : cached!.friendships;
          const requests = await api.getFriendshipRequests();
          const pendingRaw = await api.getFriendInvitations();
          const pendingInvitationLinks = buildPendingInvitationLinks(
            pendingRaw,
            labels,
          );
          setFriendshipsCache(ownerKeyId, {
            friendships,
            invitationLabelByToken: labels,
            incomingRequests: requests.incoming,
            outgoingRequests: requests.outgoing,
            pendingInvitations: pendingInvitationLinks,
            hasFriendships: true,
            hasUsersData: true,
          });
          setRawFriendships(friendships);
          setInvitationLabelByToken(labels);
          setIncomingRequests(requests.incoming);
          setOutgoingRequests(requests.outgoing);
          setPendingInvitations(pendingInvitationLinks);
          setFriendshipsError(null);
        } catch (e) {
          const message = friendshipRequestErrorMessage(e);
          const cached = getFriendshipsCache(ownerKeyId);
          if (cached && cacheHasUsersData(cached)) {
            applyFullCache(
              cached,
              setRawFriendships,
              setInvitationLabelByToken,
              setIncomingRequests,
              setOutgoingRequests,
              setPendingInvitations,
            );
          } else if (cached && cacheHasFriendships(cached)) {
            applyFriendshipsCache(
              cached,
              setRawFriendships,
              setInvitationLabelByToken,
            );
            setIncomingRequests([]);
            setOutgoingRequests([]);
            setPendingInvitations([]);
          } else {
            setRawFriendships([]);
            setInvitationLabelByToken({});
            setIncomingRequests([]);
            setOutgoingRequests([]);
            setPendingInvitations([]);
          }
          setUsersError(message);
        } finally {
          await waitForMinDuration(startedAt, USERS_DRAWER_LOADING_MIN_MS);
          setUsersLoading(false);
        }
      };

      const inflight = loadUsers();
      usersInflightRef.current = inflight;
      try {
        await inflight;
      } finally {
        if (usersInflightRef.current === inflight) {
          usersInflightRef.current = null;
        }
      }
    },
    [api, ownerKeyId],
  );

  const refresh = useCallback(
    (refreshOptions?: RefreshFriendshipsOptions) =>
      ensureUsersLoaded(refreshOptions),
    [ensureUsersLoaded],
  );

  useEffect(() => {
    if (!ownerKeyId) {
      setRawFriendships([]);
      setInvitationLabelByToken({});
      setIncomingRequests([]);
      setOutgoingRequests([]);
      setPendingInvitations([]);
      setFriendshipsError(null);
      setUsersError(null);
      return;
    }

    const cached = getFriendshipsCache(ownerKeyId);
    if (!cached) {
      return;
    }
    if (cacheHasUsersData(cached)) {
      applyFullCache(
        cached,
        setRawFriendships,
        setInvitationLabelByToken,
        setIncomingRequests,
        setOutgoingRequests,
        setPendingInvitations,
      );
      return;
    }
    if (cacheHasFriendships(cached)) {
      applyFriendshipsCache(
        cached,
        setRawFriendships,
        setInvitationLabelByToken,
      );
    }
  }, [ownerKeyId]);

  const updateInvitationLabel = useCallback(
    (token: string, label: string) => {
      const trimmed = label.trim();
      setPendingInvitations((current) => {
        const next = current.map((invitation) =>
          invitation.token === token
            ? { ...invitation, label: trimmed || null }
            : invitation,
        );
        if (ownerKeyId) {
          const cached = getFriendshipsCache(ownerKeyId);
          if (cached) {
            setFriendshipsCache(ownerKeyId, {
              ...cached,
              pendingInvitations: next,
            });
          }
        }
        return next;
      });
    },
    [ownerKeyId],
  );

  useEffect(() => {
    if (!ownerKeyId || !addLocalUser || rawFriendships.length === 0) {
      return;
    }

    void (async () => {
      for (const friendship of rawFriendships) {
        const token = friendship.invitationToken;
        if (!token) {
          continue;
        }

        const label = invitationLabelByToken[token]?.trim();
        if (!label) {
          continue;
        }
        if (usernameByKeyId[friendship.friendKeyId]) {
          continue;
        }

        try {
          await saveFeedLabUser(ownerKeyId, label, {
            kty: 'EC',
            crv: 'P-256',
            x: friendship.publicKey.x,
            y: friendship.publicKey.y,
          });
          addLocalUser({ keyId: friendship.friendKeyId, username: label });
        } catch {
          /* username may already be taken by another key */
        }
      }
    })();
  }, [
    addLocalUser,
    invitationLabelByToken,
    ownerKeyId,
    rawFriendships,
    usernameByKeyId,
  ]);

  const friends = useMemo(
    () =>
      mapFriendshipsToFriends(
        rawFriendships,
        usernameByKeyId,
        invitationLabelByToken,
      ),
    [rawFriendships, usernameByKeyId, invitationLabelByToken],
  );

  const friendKeyIds = useMemo(
    () => friends.map((friend) => friend.keyId),
    [friends],
  );

  const friendLabels = useMemo(
    () => friends.map((friend) => friend.label),
    [friends],
  );

  return useMemo(
    () => ({
      friends,
      friendKeyIds,
      friendLabels,
      invitationLabelByToken,
      incomingRequests,
      outgoingRequests,
      pendingInvitations,
      friendshipsLoading,
      friendshipsError,
      usersLoading,
      usersError,
      ensureFriendshipsLoaded,
      ensureUsersLoaded,
      refresh,
      updateInvitationLabel,
    }),
    [
      ensureFriendshipsLoaded,
      ensureUsersLoaded,
      friendKeyIds,
      friendLabels,
      friends,
      friendshipsError,
      friendshipsLoading,
      incomingRequests,
      invitationLabelByToken,
      outgoingRequests,
      pendingInvitations,
      refresh,
      updateInvitationLabel,
      usersError,
      usersLoading,
    ],
  );
}
