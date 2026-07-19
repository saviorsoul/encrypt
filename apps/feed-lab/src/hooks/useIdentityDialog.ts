import { useCallback, useState } from 'react';
import { formatEcPublicKeyText } from '@encrypt/core/crypto/ecPublicKey';
import type { IdentityDialogTarget } from '@lab/components/IdentityDialog.tsx';
import { useBackendFriendshipRequests } from '@lab/hooks/useBackendFriendshipRequests.ts';
import { saveFeedLabUser } from '@lab/services/db/storedUsers.ts';

type UseIdentityDialogOptions = {
  keyId: string | null;
  usernameByKeyId: Record<string, string>;
  usernames: string[];
  addLocalUser: (input: { keyId: string; username: string }) => void;
  friendKeyIds: string[];
  onFriendshipsChanged?: () => void | Promise<void>;
};

export function useIdentityDialog({
  keyId,
  usernameByKeyId,
  usernames,
  addLocalUser,
  friendKeyIds,
  onFriendshipsChanged,
}: UseIdentityDialogOptions) {
  const [open, setOpen] = useState(false);
  const [identity, setIdentity] = useState<IdentityDialogTarget | null>(null);
  const friendshipRequests = useBackendFriendshipRequests(
    onFriendshipsChanged,
    addLocalUser,
  );

  const openIdentity = useCallback(
    (next: IdentityDialogTarget) => {
      friendshipRequests.clearError();
      friendshipRequests.clearInfo();
      setIdentity(next);
      setOpen(true);
    },
    [friendshipRequests],
  );

  const closeIdentity = useCallback(() => {
    setOpen(false);
    friendshipRequests.clearError();
    friendshipRequests.clearInfo();
  }, [friendshipRequests]);

  const handleExited = useCallback(() => {
    setIdentity(null);
  }, []);

  const addFriend = useCallback(
    async (name: string) => {
      if (!keyId || !identity) {
        return { ok: false };
      }
      return friendshipRequests.sendRequestByPublicKey(
        keyId,
        formatEcPublicKeyText(identity.publicKey),
        name,
        usernames,
        usernameByKeyId,
      );
    },
    [friendshipRequests, identity, keyId, usernameByKeyId, usernames],
  );

  const saveName = useCallback(
    async (name: string) => {
      if (!keyId || !identity) {
        return { ok: false as const, error: 'Missing session or identity.' };
      }
      const trimmed = name.trim();
      try {
        await saveFeedLabUser(keyId, trimmed, {
          kty: 'EC',
          crv: 'P-256',
          x: identity.publicKey.x,
          y: identity.publicKey.y,
        });
        addLocalUser({
          keyId: identity.keyId,
          username: trimmed,
        });
        setIdentity((current) =>
          current
            ? {
                ...current,
                label: trimmed,
              }
            : null,
        );
        return { ok: true as const };
      } catch (e) {
        return {
          ok: false as const,
          error: e instanceof Error ? e.message : 'Failed to save name.',
        };
      }
    },
    [addLocalUser, identity, keyId],
  );

  const isSelf =
    identity !== null && keyId !== null && identity.keyId === keyId;
  const isFriend = identity !== null && friendKeyIds.includes(identity.keyId);
  const existingUsername = identity
    ? (usernameByKeyId[identity.keyId] ?? '')
    : '';

  return {
    openIdentity,
    dialogProps: {
      open,
      identity,
      isSelf,
      isFriend,
      existingUsername,
      existingUsernames: usernames,
      busy: friendshipRequests.busy,
      error: friendshipRequests.error,
      info: friendshipRequests.info,
      onClose: closeIdentity,
      onExited: handleExited,
      onClearError: friendshipRequests.clearError,
      onAddFriend: addFriend,
      onSaveName: saveName,
    },
  };
}
