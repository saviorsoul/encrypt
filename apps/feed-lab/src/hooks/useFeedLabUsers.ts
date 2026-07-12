import { useCallback, useEffect, useState } from 'react';
import { listFeedLabStoredUsers } from '@lab/services/db/storedUsers.ts';

export function useFeedLabUsers(ownerKeyId: string | null) {
  const [usernames, setUsernames] = useState<string[]>([]);
  const [usernameByKeyId, setUsernameByKeyId] = useState<
    Record<string, string>
  >({});
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const refresh = useCallback(
    async (overrideOwnerKeyId?: string | null) => {
      const activeOwnerKeyId = overrideOwnerKeyId ?? ownerKeyId;
      if (!activeOwnerKeyId) {
        setUsernames([]);
        setUsernameByKeyId({});
        return;
      }

      const storedUsers = await listFeedLabStoredUsers(activeOwnerKeyId);

      setUsernames(storedUsers.map((user) => user.username));
      setUsernameByKeyId(
        Object.fromEntries(
          storedUsers.map((user) => [user.keyId, user.username]),
        ),
      );
    },
    [ownerKeyId],
  );

  const addLocalUser = useCallback(
    (input: { keyId: string; username: string }) => {
      setUsernameByKeyId((prev) => {
        if (prev[input.keyId] === input.username) {
          return prev;
        }
        return {
          ...prev,
          [input.keyId]: input.username,
        };
      });
      setUsernames((prev) => {
        if (prev.includes(input.username)) {
          return prev;
        }
        return [...prev, input.username].sort((a, b) => a.localeCompare(b));
      });
    },
    [],
  );

  useEffect(() => {
    let cancelled = false;

    async function load() {
      setLoading(true);
      setError(null);
      try {
        await refresh();
      } catch (e) {
        if (!cancelled) {
          setError(e instanceof Error ? e.message : 'Failed to load users.');
          setUsernames([]);
          setUsernameByKeyId({});
        }
      } finally {
        if (!cancelled) {
          setLoading(false);
        }
      }
    }

    void load();

    return () => {
      cancelled = true;
    };
  }, [refresh]);

  return {
    usernames,
    usernameByKeyId,
    loading,
    error,
    refresh,
    addLocalUser,
  };
}
