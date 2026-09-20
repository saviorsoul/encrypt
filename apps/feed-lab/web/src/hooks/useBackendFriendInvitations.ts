import { useCallback, useState } from 'react';
import { useFeedApi } from '@lab/providers/FeedApiProvider.tsx';
import { useFeedLabSession } from '@lab/providers/FeedLabSessionProvider.tsx';
import { clearFriendshipsCache } from '@lab/services/friendshipsCache.ts';
import {
  deleteSentInvitation,
  saveSentInvitation,
} from '@lab/services/db/sentInvitations.ts';

export function useBackendFriendInvitations(
  onChanged?: () => void | Promise<void>,
) {
  const api = useFeedApi();
  const { keys } = useFeedLabSession();
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [lastInvitationId, setLastInvitationId] = useState<string | null>(null);

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
      setLastInvitationId(null);

      try {
        const invitation = await api.postFriendInvitation();

        await saveSentInvitation(invitation.token, trimmedName, keys.keyId);
        setLastInvitationId(invitation.token);
        await onChanged?.();
        return invitation.token;
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
        await api.acceptFriendInvitation(token);
        if (keys.keyId) {
          clearFriendshipsCache(keys.keyId);
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
    [api, keys.keyId, onChanged],
  );

  const clearError = useCallback(() => {
    setError(null);
  }, []);

  const clearLastInvitationId = useCallback(() => {
    setLastInvitationId(null);
  }, []);

  const removeInvitation = useCallback(
    async (token: string): Promise<boolean> => {
      if (!keys.keyId) {
        setError('Authenticate with your private key first.');
        return false;
      }

      setBusy(true);
      setError(null);

      try {
        await api.deleteFriendInvitation(token);
        await deleteSentInvitation(token);
        if (lastInvitationId === token) {
          setLastInvitationId(null);
        }
        await onChanged?.();
        return true;
      } catch (e) {
        setError(
          e instanceof Error ? e.message : 'Could not remove invitation.',
        );
        return false;
      } finally {
        setBusy(false);
      }
    },
    [api, keys.keyId, lastInvitationId, onChanged],
  );

  return {
    busy,
    error,
    lastInvitationId,
    createInvitation,
    acceptInvitation,
    removeInvitation,
    clearError,
    clearLastInvitationId,
  };
}
