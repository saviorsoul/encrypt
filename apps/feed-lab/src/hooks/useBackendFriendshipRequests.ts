import { useCallback, useState } from 'react';
import type { CreateFriendshipRequestResult } from '@encrypt/core/api/feedApi';
import type { FeedApiRequestOptions } from '@encrypt/core/api/feedApi';
import { useFeedApi } from '@lab/providers/FeedApiProvider.tsx';
import { useFeedLabSession } from '@lab/providers/FeedLabSessionProvider.tsx';
import { useSignNetworkRequest } from '@lab/providers/SignNetworkRequestProvider.tsx';
import { abortPendingBridgeWork } from '@lab/crypto/systemAppSigner.ts';
import { ensureBackendUserFromPublicKey } from '@lab/lib/ensureBackendUserFromPublicKey.ts';
import { friendshipRequestErrorMessage } from '@lab/lib/friendshipRequestErrors.ts';
import { saveFeedLabUser } from '@lab/services/db/storedUsers.ts';
import { saveSentInvitation } from '@lab/services/db/sentInvitations.ts';

export type SendFriendRequestResult =
  | { ok: true; keyId: string; outcome: CreateFriendshipRequestResult }
  | { ok: false; error: string };

type EnsureTargetUserResult =
  | {
      ok: true;
      keyId: string;
      publicKey: { x: string; y: string };
    }
  | { ok: false; error: string };

async function resolveTargetUser(
  api: ReturnType<typeof useFeedApi>,
  publicKeyText: string,
  auth?: FeedApiRequestOptions,
): Promise<EnsureTargetUserResult> {
  return ensureBackendUserFromPublicKey(api, publicKeyText, auth);
}

function validateFriendRequestName(
  trimmedName: string,
  targetKeyId: string,
  viewerKeyId: string,
  existingUsernames: string[],
  usernameByKeyId: Record<string, string>,
): { ok: true } | { ok: false; error: string } {
  if (targetKeyId === viewerKeyId) {
    return {
      ok: false,
      error: 'Cannot send a friend request to yourself.',
    };
  }

  const existingUsernameForKey = usernameByKeyId[targetKeyId] ?? '';
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
      ok: false,
      error: `"${trimmedName}" already exists. Choose a unique name.`,
    };
  }

  return { ok: true };
}

export function useBackendFriendshipRequests(
  onChanged?: () => void | Promise<void>,
  onLocalUserSaved?: (input: { keyId: string; username: string }) => void,
) {
  const api = useFeedApi();
  const { keys } = useFeedLabSession();
  const { cancelPendingSignRequests } = useSignNetworkRequest();
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [info, setInfo] = useState<string | null>(null);

  const cancelInFlight = useCallback(() => {
    abortPendingBridgeWork();
    cancelPendingSignRequests();
    setBusy(false);
  }, [cancelPendingSignRequests]);

  const run = useCallback(
    async (action: () => Promise<void>) => {
      setBusy(true);
      setError(null);
      setInfo(null);
      try {
        await action();
        await onChanged?.();
      } catch (e) {
        setError(friendshipRequestErrorMessage(e));
      } finally {
        setBusy(false);
      }
    },
    [onChanged],
  );

  const runSignedApiCall = useCallback(
    async (action: () => Promise<void>) => {
      if (keys.isSystemAppSession) {
        await action();
        return;
      }

      const result = await keys.withPrivateKey(async () => {
        await action();
      });
      if (result === null) {
        throw new Error('Private key is required for this action.');
      }
    },
    [keys],
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
        const ensured = keys.isSystemAppSession
          ? await resolveTargetUser(api, publicKeyText)
          : await keys.withPrivateKey(async (material) =>
              resolveTargetUser(api, publicKeyText, {
                auth: { authMaterial: material },
              }),
            );

        if (!ensured) {
          const message = 'Private key is required to send a friend request.';
          setError(message);
          return { ok: false, error: message };
        }

        if (ensured.ok === false) {
          setError(ensured.error);
          return ensured;
        }

        const nameValidation = validateFriendRequestName(
          trimmedName,
          ensured.keyId,
          authenticatedKeyId,
          existingUsernames,
          usernameByKeyId,
        );
        if (!nameValidation.ok) {
          setError(nameValidation.error);
          return nameValidation;
        }

        const invitation = await api.postFriendInvitation();
        await saveSentInvitation(
          invitation.token,
          trimmedName,
          authenticatedKeyId,
        );

        const outcome = await api.postFriendshipRequest({
          targetKeyId: ensured.keyId,
          invitationToken: invitation.token,
        });

        await saveFeedLabUser(authenticatedKeyId, trimmedName, {
          kty: 'EC',
          crv: 'P-256',
          x: ensured.publicKey.x,
          y: ensured.publicKey.y,
        });
        onLocalUserSaved?.({ keyId: ensured.keyId, username: trimmedName });

        if (outcome.status === 'accepted') {
          setInfo('You are already friends with this person.');
        } else {
          setInfo('Friend request sent.');
        }

        await onChanged?.();
        return { ok: true, keyId: ensured.keyId, outcome };
      } catch (e) {
        const message = friendshipRequestErrorMessage(e);
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
        await runSignedApiCall(async () => {
          await api.acceptFriendshipRequest({ requesterKeyId });
        });
        return null;
      } catch (e) {
        const message = friendshipRequestErrorMessage(e);
        setError(message);
        return message;
      } finally {
        setBusy(false);
      }
    },
    [api, runSignedApiCall],
  );

  const rejectRequest = useCallback(
    async (requesterKeyId: string) => {
      await run(async () => {
        await runSignedApiCall(async () => {
          await api.rejectFriendshipRequest({ requesterKeyId });
        });
      });
    },
    [run, runSignedApiCall],
  );

  const unfriend = useCallback(
    async (friendKeyId: string) => {
      await run(async () => {
        await runSignedApiCall(async () => {
          await api.deleteFriendship({ friendKeyId });
        });
      });
    },
    [run, runSignedApiCall],
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
    cancelInFlight,
    clearError,
    clearInfo,
  };
}
