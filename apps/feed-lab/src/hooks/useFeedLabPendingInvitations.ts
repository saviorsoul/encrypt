import { useCallback, useEffect, useState } from 'react';
import { useFeedApi } from '@lab/providers/FeedApiProvider.tsx';
import { buildFeedLabInvitationHref } from '@lab/lib/invitationHref.ts';
import { buildSentInvitationLabelByToken } from '@lab/services/db/sentInvitations.ts';

export type PendingInvitationLink = {
  token: string;
  href: string;
  label: string | null;
  createdAt: string;
};

export function useFeedLabPendingInvitations(ownerKeyId: string | null) {
  const api = useFeedApi();
  const [invitations, setInvitations] = useState<PendingInvitationLink[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const refresh = useCallback(async () => {
    if (!ownerKeyId) {
      setInvitations([]);
      setError(null);
      return;
    }

    setLoading(true);
    setError(null);
    try {
      const [pending, labelByToken] = await Promise.all([
        api.getFriendInvitations(),
        buildSentInvitationLabelByToken(ownerKeyId),
      ]);
      setInvitations(
        pending
          .filter((invitation) => invitation.status === 'pending')
          .map((invitation) => ({
            token: invitation.token,
            href: buildFeedLabInvitationHref(invitation.token),
            label: labelByToken[invitation.token]?.trim() || null,
            createdAt: invitation.createdAt,
          })),
      );
    } catch (e) {
      setInvitations([]);
      setError(
        e instanceof Error ? e.message : 'Failed to load invitation links.',
      );
    } finally {
      setLoading(false);
    }
  }, [api, ownerKeyId]);

  useEffect(() => {
    void refresh();
  }, [refresh]);

  const updateLabel = useCallback((token: string, label: string) => {
    const trimmed = label.trim();
    setInvitations((prev) =>
      prev.map((invitation) =>
        invitation.token === token
          ? { ...invitation, label: trimmed || null }
          : invitation,
      ),
    );
  }, []);

  return {
    invitations,
    loading,
    error,
    refresh,
    updateLabel,
  };
}
