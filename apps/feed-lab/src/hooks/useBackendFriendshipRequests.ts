import { useCallback, useState } from 'react';
import { useFeedApi } from '@lab/providers/FeedApiProvider.tsx';
import { ensureBackendUserFromPublicKey } from '@lab/lib/ensureBackendUserFromPublicKey.ts';
import { saveFeedLabUser } from '@lab/services/db/storedUsers.ts';

export function useBackendFriendshipRequests(
  onChanged?: () => void | Promise<void>,
  onLocalUserSaved?: (input: { keyId: string; username: string }) => void,
) {
  const api = useFeedApi();
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const run = useCallback(
    async (action: () => Promise<void>) => {
      setBusy(true);
      setError(null);
      try {
        await action();
        await onChanged?.();
      } catch (e) {
        setError(e instanceof Error ? e.message : 'Friendship request failed.');
      } finally {
        setBusy(false);
      }
    },
    [onChanged],
  );

  const sendRequest = useCallback(
    async (requesterKeyId: string, targetKeyId: string) => {
      await run(async () => {
        await api.postFriendshipRequest({ requesterKeyId, targetKeyId });
      });
    },
    [api, run],
  );

  const sendRequestByPublicKey = useCallback(
    async (
      requesterKeyId: string,
      publicKeyText: string,
      username: string,
      existingUsernames: string[],
      usernameByKeyId: Record<string, string>,
    ): Promise<string | null> => {
      const trimmedName = username.trim();
      if (!trimmedName) {
        setError('Enter a name for this friend.');
        return null;
      }

      setBusy(true);
      setError(null);
      try {
        const ensured = await ensureBackendUserFromPublicKey(
          api,
          publicKeyText,
        );
        if (ensured.ok === false) {
          setError(ensured.error);
          return null;
        }

        if (ensured.keyId === requesterKeyId) {
          setError('Cannot send a friend request to yourself.');
          return null;
        }

        const existingUsernameForKey = usernameByKeyId[ensured.keyId] ?? '';
        const nameTaken =
          existingUsernames.some(
            (existing) =>
              existing.localeCompare(trimmedName, undefined, {
                sensitivity: 'accent',
              }) === 0,
          ) &&
          trimmedName.localeCompare(existingUsernameForKey, undefined, {
            sensitivity: 'accent',
          }) !== 0;
        if (nameTaken) {
          setError(`"${trimmedName}" already exists. Choose a unique name.`);
          return null;
        }

        await saveFeedLabUser(trimmedName, {
          kty: 'EC',
          crv: 'P-256',
          x: ensured.publicKey.x,
          y: ensured.publicKey.y,
        });
        onLocalUserSaved?.({ keyId: ensured.keyId, username: trimmedName });

        await api.postFriendshipRequest({
          requesterKeyId,
          targetKeyId: ensured.keyId,
        });
        await onChanged?.();
        return ensured.keyId;
      } catch (e) {
        setError(e instanceof Error ? e.message : 'Friendship request failed.');
        return null;
      } finally {
        setBusy(false);
      }
    },
    [api, onChanged, onLocalUserSaved],
  );

  const acceptRequest = useCallback(
    async (
      requesterKeyId: string,
      targetKeyId: string,
    ): Promise<string | null> => {
      setBusy(true);
      setError(null);
      try {
        await api.acceptFriendshipRequest({ requesterKeyId, targetKeyId });
        await onChanged?.();
        return null;
      } catch (e) {
        const message =
          e instanceof Error ? e.message : 'Friendship request failed.';
        setError(message);
        return message;
      } finally {
        setBusy(false);
      }
    },
    [api, onChanged],
  );

  const rejectRequest = useCallback(
    async (requesterKeyId: string, targetKeyId: string) => {
      await run(async () => {
        await api.rejectFriendshipRequest({ requesterKeyId, targetKeyId });
      });
    },
    [api, run],
  );

  const unfriend = useCallback(
    async (ownerKeyId: string, friendKeyId: string) => {
      await run(async () => {
        await api.deleteFriendship({ ownerKeyId, friendKeyId });
      });
    },
    [api, run],
  );

  const clearError = useCallback(() => {
    setError(null);
  }, []);

  return {
    busy,
    error,
    sendRequest,
    sendRequestByPublicKey,
    acceptRequest,
    rejectRequest,
    unfriend,
    clearError,
  };
}
