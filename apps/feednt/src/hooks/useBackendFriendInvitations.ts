import { useCallback, useState } from 'react';
import { useFeedApi } from '@feednt/providers/FeedApiProvider.tsx';
import { useFeedntSession } from '@feednt/providers/FeedntSessionProvider.tsx';
import { saveSentInvitation } from '@feednt/services/db/sentInvitations.ts';

export function useBackendFriendInvitations(
  onChanged?: () => void | Promise<void>,
) {
  const api = useFeedApi();
  const { keys } = useFeedntSession();
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
    [api, onChanged],
  );

  const clearError = useCallback(() => {
    setError(null);
  }, []);

  const clearLastInvitationId = useCallback(() => {
    setLastInvitationId(null);
  }, []);

  return {
    busy,
    error,
    lastInvitationId,
    createInvitation,
    acceptInvitation,
    clearError,
    clearLastInvitationId,
  };
}
