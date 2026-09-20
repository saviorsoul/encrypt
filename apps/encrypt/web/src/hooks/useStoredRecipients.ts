import { useEffect, useRef, useState } from 'react';
import { loadRecipientKeysForUsername } from '@/services/db/storedPublicKeys.ts';
import type { ManifestRecipientKeys } from '@/crypto/manifestEncrypt.ts';
import { useStoredUsernames } from '@/hooks/useStoredUsernames.ts';

export function useStoredRecipients() {
  const {
    usernames: availableUsernames,
    loading: loadingUsers,
    error: usernamesError,
  } = useStoredUsernames();

  const [selectedUsernames, setSelectedUsernames] = useState<string[]>([]);
  const [recipients, setRecipients] = useState<ManifestRecipientKeys[]>([]);
  const [loadingRecipientKeys, setLoadingRecipientKeys] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [prevAvailableUsernames, setPrevAvailableUsernames] =
    useState(availableUsernames);
  const [prevUsernamesError, setPrevUsernamesError] = useState(usernamesError);
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

  if (usernamesError !== prevUsernamesError) {
    setPrevUsernamesError(usernamesError);
    if (usernamesError) {
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
    availableUsernames,
    selectedUsernames,
    setSelectedUsernames,
    recipients,
    loadingUsers,
    loadingRecipientKeys,
    error: error ?? usernamesError,
  };
}
