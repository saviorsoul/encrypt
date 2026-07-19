import { useCallback, useState } from 'react';
import type { CreateFriendshipRequestResult } from '@encrypt/core/api/feedApi';
import { useFeedApi } from '@lab/providers/FeedApiProvider.tsx';
import { useFeedLabSession } from '@lab/providers/FeedLabSessionProvider.tsx';
import { ensureBackendUserFromPublicKey } from '@lab/lib/ensureBackendUserFromPublicKey.ts';
import { saveFeedLabUser } from '@lab/services/db/storedUsers.ts';
import { saveSentInvitation } from '@lab/services/db/sentInvitations.ts';

export type SendFriendRequestResult =
  | { ok: true; keyId: string; outcome: CreateFriendshipRequestResult }
  | { ok: false; error: string };

export function useBackendFriendshipRequests(
  onChanged?: () => void | Promise<void>,
  onLocalUserSaved?: (input: { keyId: string; username: string }) => void,
) {
  const api = useFeedApi();
  const { keys } = useFeedLabSession();
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [info, setInfo] = useState<string | null>(null);

  const run = useCallback(
    async (action: () => Promise<void>) => {
      setBusy(true);
      setError(null);
      setInfo(null);
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

  const sendRequestByPublicKey = useCallback(
    async (
      authenticatedKeyId: string,
      publicKeyText: string,
      username: string,
      existingUsernames: string[],
      usernameByKeyId: Record<string, string>,
    ): Promise<SendFriendRequestResult> => {
      const trimmedName = username.trim();
      if (!trimmedName) {
        const message = 'Enter a name for this friend.';
        setError(message);
        return { ok: false, error: message };
      }

      if (!keys.keyId) {
        const message = 'Authenticate with your private key first.';
        setError(message);
        return { ok: false, error: message };
      }

      setBusy(true);
      setError(null);
      setInfo(null);
      try {
        const result = await keys.withPrivateKey(async (material) => {
          const auth = { auth: { authMaterial: material } };

          const ensured = await ensureBackendUserFromPublicKey(
            api,
            publicKeyText,
            auth,
          );
          if (ensured.ok === false) {
            return { ok: false as const, error: ensured.error };
          }

          if (ensured.keyId === authenticatedKeyId) {
            return {
              ok: false as const,
              error: 'Cannot send a friend request to yourself.',
            };
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
            return {
              ok: false as const,
              error: `"${trimmedName}" already exists. Choose a unique name.`,
            };
          }

          await saveFeedLabUser(authenticatedKeyId, trimmedName, {
            kty: 'EC',
            crv: 'P-256',
            x: ensured.publicKey.x,
            y: ensured.publicKey.y,
          });
          onLocalUserSaved?.({ keyId: ensured.keyId, username: trimmedName });

          const invitation = await api.postFriendInvitation();
          await saveSentInvitation(
            invitation.token,
            trimmedName,
            material.keyId,
          );

          const outcome = await api.postFriendshipRequest({
            targetKeyId: ensured.keyId,
            invitationToken: invitation.token,
          });

          return {
            ok: true as const,
            keyId: ensured.keyId,
            outcome,
          };
        });

        if (!result) {
          const message = 'Private key is required to send a friend request.';
          setError(message);
          return { ok: false, error: message };
        }

        if (!result.ok) {
          setError(result.error);
          return result;
        }

        if (result.outcome.status === 'accepted') {
          setInfo('You are already friends with this person.');
        } else {
          setInfo('Friend request sent.');
        }

        await onChanged?.();
        return result;
      } catch (e) {
        const message =
          e instanceof Error ? e.message : 'Friendship request failed.';
        setError(message);
        return { ok: false, error: message };
      } finally {
        setBusy(false);
      }
    },
    [api, keys, onChanged, onLocalUserSaved],
  );

  const acceptRequest = useCallback(
    async (requesterKeyId: string): Promise<string | null> => {
      setBusy(true);
      setError(null);
      setInfo(null);
      try {
        await keys.withPrivateKey(async () => {
          await api.acceptFriendshipRequest({ requesterKeyId });
        });
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
    [api, keys],
  );

  const rejectRequest = useCallback(
    async (requesterKeyId: string) => {
      await run(async () => {
        await keys.withPrivateKey(async () => {
          await api.rejectFriendshipRequest({ requesterKeyId });
        });
      });
    },
    [api, keys, run],
  );

  const unfriend = useCallback(
    async (friendKeyId: string) => {
      await run(async () => {
        await keys.withPrivateKey(async () => {
          await api.deleteFriendship({ friendKeyId });
        });
      });
    },
    [api, keys, run],
  );

  const clearError = useCallback(() => {
    setError(null);
  }, []);

  const clearInfo = useCallback(() => {
    setInfo(null);
  }, []);

  return {
    busy,
    error,
    info,
    sendRequestByPublicKey,
    acceptRequest,
    rejectRequest,
    unfriend,
    clearError,
    clearInfo,
  };
}
