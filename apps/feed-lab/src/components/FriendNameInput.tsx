import React, { useCallback } from 'react';
import { LocalNameInput } from '@lab/components/LocalNameInput.tsx';
import { saveFeedLabUser } from '@lab/services/db/storedUsers.ts';

type FriendNameInputProps = {
  friendKeyId: string;
  publicKey: { x: string; y: string };
  ownerKeyId: string;
  existingUsernames: string[];
  currentUsername?: string;
  initialValue?: string;
  autoFocus?: boolean;
  disabled?: boolean;
  onSaved: (input: { keyId: string; username: string }) => void;
  onEditEnd?: () => void;
};

export function FriendNameInput({
  friendKeyId,
  publicKey,
  ownerKeyId,
  existingUsernames,
  currentUsername = '',
  initialValue = '',
  autoFocus = false,
  disabled = false,
  onSaved,
  onEditEnd,
}: FriendNameInputProps) {
  const handleSave = useCallback(
    async (name: string) => {
      await saveFeedLabUser(ownerKeyId, name, {
        kty: 'EC',
        crv: 'P-256',
        x: publicKey.x,
        y: publicKey.y,
      });
      onSaved({ keyId: friendKeyId, username: name });
    },
    [friendKeyId, onSaved, ownerKeyId, publicKey.x, publicKey.y],
  );

  return (
    <LocalNameInput
      existingNames={existingUsernames}
      currentName={currentUsername}
      initialValue={initialValue}
      autoFocus={autoFocus}
      disabled={disabled}
      onSave={handleSave}
      onEditEnd={onEditEnd}
    />
  );
}
