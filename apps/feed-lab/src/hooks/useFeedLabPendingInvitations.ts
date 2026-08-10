export type { PendingInvitationLink } from '@lab/services/friendshipsCache.ts';

import { useCallback, useEffect, useState } from 'react';
import { useFeedApi } from '@lab/providers/FeedApiProvider.tsx';
import { friendshipRequestErrorMessage } from '@lab/lib/friendshipRequestErrors.ts';
import { buildFeedLabInvitationHref } from '@lab/lib/invitationHref.ts';
import { buildSentInvitationLabelByToken } from '@lab/services/db/sentInvitations.ts';
import {
  cacheHasUsersData,
  getFriendshipsCache,
  setFriendshipsCache,
  type PendingInvitationLink,
} from '@lab/services/friendshipsCache.ts';

export type RefreshPendingInvitationsOptions = {
  force?: boolean;
};

export function useFeedLabPendingInvitations(ownerKeyId: string | null) {
  const api = useFeedApi();
  const [invitations, setInvitations] = useState<PendingInvitationLink[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const refresh = useCallback(
    async (refreshOptions?: RefreshPendingInvitationsOptions) => {
      if (!ownerKeyId) {
        setInvitations([]);
        setError(null);
        return;
      }

      const force = refreshOptions?.force === true;
      if (!force) {
        const cached = getFriendshipsCache(ownerKeyId);
        if (cached && cacheHasUsersData(cached)) {
          setInvitations(cached.pendingInvitations);
          setError(null);
          return;
        }
      }

      setLoading(true);
      setError(null);
      try {
        const [pending, labelByToken] = await Promise.all([
          api.getFriendInvitations(),
          buildSentInvitationLabelByToken(ownerKeyId),
        ]);
        const nextInvitations = pending
          .filter((invitation) => invitation.status === 'pending')
          .map((invitation) => ({
            token: invitation.token,
            href: buildFeedLabInvitationHref(invitation.token),
            label: labelByToken[invitation.token]?.trim() || null,
            createdAt: invitation.createdAt,
          }));
        const cached = getFriendshipsCache(ownerKeyId);
        if (cached) {
          setFriendshipsCache(ownerKeyId, {
            ...cached,
            pendingInvitations: nextInvitations,
            hasUsersData: true,
          });
        }
        setInvitations(nextInvitations);
      } catch (e) {
        setInvitations([]);
        setError(friendshipRequestErrorMessage(e));
      } finally {
        setLoading(false);
      }
    },
    [api, ownerKeyId],
  );

  useEffect(() => {
    if (!ownerKeyId) {
      setInvitations([]);
      setError(null);
      return;
    }

    const cached = getFriendshipsCache(ownerKeyId);
    if (cached && cacheHasUsersData(cached)) {
      setInvitations(cached.pendingInvitations);
      setError(null);
    }
  }, [ownerKeyId]);

  const updateLabel = useCallback(
    (token: string, label: string) => {
      const trimmed = label.trim();
      setInvitations((prev) => {
        const next = prev.map((invitation) =>
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

  return {
    invitations,
    loading,
    error,
    refresh,
    updateLabel,
  };
}
