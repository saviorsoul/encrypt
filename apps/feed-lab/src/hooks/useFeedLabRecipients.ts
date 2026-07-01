import { useEffect, useRef, useState } from 'react';
import type { ManifestRecipientKeys } from '@encrypt/core/types/manifest';
import { loadRecipientKeysForUsername } from '@lab/services/db/storedUsers.ts';

type FeedLabRecipientsInput = {
  availableUsernames: string[];
  loadingUsers: boolean;
  usersError: string | null;
};

export function useFeedLabRecipients({
  availableUsernames,
  loadingUsers,
  usersError,
}: FeedLabRecipientsInput) {
  const [selectedUsernames, setSelectedUsernames] = useState<string[]>([]);
  const [recipients, setRecipients] = useState<ManifestRecipientKeys[]>([]);
  const [loadingRecipientKeys, setLoadingRecipientKeys] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [prevAvailableUsernames, setPrevAvailableUsernames] =
    useState(availableUsernames);
  const [prevUsersError, setPrevUsersError] = useState(usersError);
  const [prevSelectedUsernamesKey, setPrevSelectedUsernamesKey] = useState('');
  const recipientCacheRef = useRef<Map<string, ManifestRecipientKeys>>(
    new Map(),
  );

  const selectedUsernamesKey = selectedUsernames.join('\0');

  if (availableUsernames !== prevAvailableUsernames) {
    setPrevAvailableUsernames(availableUsernames);
    setSelectedUsernames((prev) => {
      const stillValid = prev.filter((name) =>
        availableUsernames.includes(name),
      );
      if (stillValid.length > 0) {
        return stillValid;
      }
      return availableUsernames;
    });
  }

  if (usersError !== prevUsersError) {
    setPrevUsersError(usersError);
    if (usersError) {
      setSelectedUsernames([]);
    }
  }

  if (selectedUsernamesKey !== prevSelectedUsernamesKey) {
    setPrevSelectedUsernamesKey(selectedUsernamesKey);
    if (selectedUsernames.length === 0) {
      setRecipients([]);
      setLoadingRecipientKeys(false);
    }
  }

  useEffect(() => {
    if (selectedUsernames.length === 0) {
      return;
    }

    let cancelled = false;
    const cache = recipientCacheRef.current;

    if (selectedUsernames.every((username) => cache.has(username))) {
      setRecipients(selectedUsernames.map((username) => cache.get(username)!));
      setLoadingRecipientKeys(false);
      return;
    }

    setRecipients(
      selectedUsernames
        .map((username) => cache.get(username) ?? null)
        .filter(Boolean) as ManifestRecipientKeys[],
    );

    const missingUsernames = selectedUsernames.filter(
      (username) => !cache.has(username),
    );

    async function loadMissingRecipients() {
      setLoadingRecipientKeys(true);
      setError(null);
      try {
        const loaded = await Promise.all(
          missingUsernames.map((username) =>
            loadRecipientKeysForUsername(username),
          ),
        );
        if (cancelled) {
          return;
        }

        const stillMissing = missingUsernames.filter(
          (_, i) => loaded[i] === null,
        );
        if (stillMissing.length > 0) {
          setError(`No public key found for: ${stillMissing.join(', ')}`);
          setRecipients(
            selectedUsernames
              .map((username) => cache.get(username) ?? null)
              .filter(
                (entry): entry is ManifestRecipientKeys => entry !== null,
              ),
          );
          return;
        }

        missingUsernames.forEach((username, i) => {
          cache.set(username, loaded[i]!);
        });

        setRecipients(
          selectedUsernames.map((username) => cache.get(username)!),
        );
      } catch (e) {
        if (!cancelled) {
          setError(
            e instanceof Error ? e.message : 'Failed to load recipient keys.',
          );
        }
      } finally {
        if (!cancelled) {
          setLoadingRecipientKeys(false);
        }
      }
    }

    void loadMissingRecipients();

    return () => {
      cancelled = true;
    };
  }, [selectedUsernames]);

  return {
    selectedUsernames,
    setSelectedUsernames,
    recipients,
    loadingUsers,
    loadingRecipientKeys,
    error: error ?? usersError,
  };
}
