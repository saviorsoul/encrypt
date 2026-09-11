import { useCallback, useMemo, useState } from 'react';
import type { FriendshipMuteScope } from '@encrypt/core/api/feedApi';
import type { IdentityDialogTarget } from '../components/IdentityDialog.tsx';

export type UseIdentityDialogOptions = {
  keyId: string | null;
  usernameByKeyId: Record<string, string>;
  addLocalUser: (input: { keyId: string; username: string }) => void;
  friendKeyIds: string[];
  saveLocalUser: (
    ownerKeyId: string,
    username: string,
    publicKey: { x: string; y: string },
  ) => Promise<void>;
  friendshipsLoading?: boolean;
  friendshipsError?: string | null;
  busy?: boolean;
  error?: string | null;
  info?: string | null;
  onOpenIdentity?: (target: IdentityDialogTarget) => void;
  onCloseIdentity?: () => void;
  onClearError?: () => void;
  onCancelInFlight?: () => void;
  onAddFriend?: (
    name: string,
    identity: IdentityDialogTarget,
  ) => Promise<{ ok: boolean }>;
  getFriendMute?: (
    keyId: string,
  ) => { messagesMuted: boolean; sharesMuted: boolean } | undefined;
  onToggleFriendMute?: (
    friendKeyId: string,
    scope: FriendshipMuteScope,
  ) => Promise<{ ok: boolean; error?: string }>;
};

export function useIdentityDialog({
  keyId,
  usernameByKeyId,
  addLocalUser,
  friendKeyIds,
  saveLocalUser,
  friendshipsLoading = false,
  friendshipsError = null,
  busy = false,
  error = null,
  info = null,
  onOpenIdentity,
  onCloseIdentity,
  onClearError,
  onCancelInFlight,
  onAddFriend,
  getFriendMute,
  onToggleFriendMute,
}: UseIdentityDialogOptions) {
  const [open, setOpen] = useState(false);
  const [identity, setIdentity] = useState<IdentityDialogTarget | null>(null);

  const openIdentity = useCallback(
    (next: IdentityDialogTarget) => {
      onOpenIdentity?.(next);
      setIdentity(next);
      setOpen(true);
    },
    [onOpenIdentity],
  );

  const closeIdentity = useCallback(() => {
    onCloseIdentity?.();
    setOpen(false);
  }, [onCloseIdentity]);

  const handleExited = useCallback(() => {
    setIdentity(null);
  }, []);

  const addFriend = useCallback(
    async (name: string) => {
      if (!identity || !onAddFriend) {
        return { ok: false };
      }
      return onAddFriend(name, identity);
    },
    [identity, onAddFriend],
  );

  const toggleMessagesMute = useCallback(async () => {
    if (!identity || !onToggleFriendMute) {
      return { ok: false, error: 'Mute is unavailable.' };
    }
    return onToggleFriendMute(identity.keyId, 'messages');
  }, [identity, onToggleFriendMute]);

  const toggleSharesMute = useCallback(async () => {
    if (!identity || !onToggleFriendMute) {
      return { ok: false, error: 'Mute is unavailable.' };
    }
    return onToggleFriendMute(identity.keyId, 'shares');
  }, [identity, onToggleFriendMute]);

  const saveName = useCallback(
    async (name: string) => {
      if (!keyId || !identity) {
        return { ok: false as const, error: 'Missing session or identity.' };
      }
      const trimmed = name.trim();
      try {
        await saveLocalUser(keyId, trimmed, identity.publicKey);
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
    [addLocalUser, identity, keyId, saveLocalUser],
  );

  const isSelf =
    identity !== null && keyId !== null && identity.keyId === keyId;
  const isFriend = identity !== null && friendKeyIds.includes(identity.keyId);
  const existingUsername = identity
    ? (usernameByKeyId[identity.keyId] ?? '')
    : '';
  const existingUsernames = useMemo(
    () => Object.values(usernameByKeyId),
    [usernameByKeyId],
  );
  const friendMute =
    identity && isFriend ? getFriendMute?.(identity.keyId) : undefined;

  return {
    openIdentity,
    dialogProps: {
      open,
      identity,
      isSelf,
      isFriend,
      existingUsername,
      existingUsernames,
      friendshipsLoading,
      friendshipsError,
      busy,
      error,
      info,
      onClose: closeIdentity,
      onExited: handleExited,
      onClearError: onClearError ?? (() => {}),
      onCancelInFlight: onCancelInFlight ?? (() => {}),
      onAddFriend: addFriend,
      onSaveName: saveName,
      messagesMuted: friendMute?.messagesMuted ?? false,
      sharesMuted: friendMute?.sharesMuted ?? false,
      onToggleMessagesMute: isFriend ? toggleMessagesMute : undefined,
      onToggleSharesMute: isFriend ? toggleSharesMute : undefined,
    },
  };
}
