import { useCallback, useState } from 'react';
import { useFeedApi } from '@lab/providers/FeedApiProvider.tsx';
import { useFeedLabSession } from '@lab/providers/FeedLabSessionProvider.tsx';
import { buildFeedLabInvitationHref } from '@lab/lib/invitationHref.ts';
import { saveSentInvitation } from '@lab/services/db/sentInvitations.ts';

export function useBackendFriendInvitations(
  onChanged?: () => void | Promise<void>,
) {
  const api = useFeedApi();
  const { keys } = useFeedLabSession();
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [lastInvitationHref, setLastInvitationHref] = useState<string | null>(
    null,
  );

  const createInvitation = useCallback(
    async (name: string): Promise<string | null> => {
      const trimmedName = name.trim();
      if (!trimmedName) {
        setError('Enter a name for this person.');
        return null;
      }

      if (!keys.keyId) {
        setError('Authenticate with your private key first.');
        return null;
      }

      setBusy(true);
      setError(null);
      setLastInvitationHref(null);

      try {
        const invitation = await keys.withPrivateKey(async () => {
          return api.postFriendInvitation();
        });

        if (!invitation) {
          return null;
        }

        await saveSentInvitation(invitation.token, trimmedName, keys.keyId);
        const href = buildFeedLabInvitationHref(invitation.token);
        setLastInvitationHref(href);
        await onChanged?.();
        return href;
      } catch (e) {
        setError(
          e instanceof Error ? e.message : 'Could not create invitation.',
        );
        return null;
      } finally {
        setBusy(false);
      }
    },
    [api, keys, onChanged],
  );

  const acceptInvitation = useCallback(
    async (token: string): Promise<boolean> => {
      setBusy(true);
      setError(null);

      try {
        const accepted = await keys.withPrivateKey(async () => {
          await api.acceptFriendInvitation(token);
        });

        if (!accepted) {
          return false;
        }

        await onChanged?.();
        return true;
      } catch (e) {
        setError(
          e instanceof Error ? e.message : 'Could not accept invitation.',
        );
        return false;
      } finally {
        setBusy(false);
      }
    },
    [api, keys, onChanged],
  );

  const clearError = useCallback(() => {
    setError(null);
  }, []);

  const clearLastInvitationHref = useCallback(() => {
    setLastInvitationHref(null);
  }, []);

  return {
    busy,
    error,
    lastInvitationHref,
    createInvitation,
    acceptInvitation,
    clearError,
    clearLastInvitationHref,
  };
}
