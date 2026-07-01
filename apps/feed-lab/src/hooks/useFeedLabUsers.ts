import { useCallback, useEffect, useState } from 'react';
import { listFeedLabStoredUsers } from '@lab/services/db/storedUsers.ts';

export function useFeedLabUsers() {
  const [usernames, setUsernames] = useState<string[]>([]);
  const [usernameByKeyId, setUsernameByKeyId] = useState<
    Record<string, string>
  >({});
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const refresh = useCallback(async () => {
    const storedUsers = await listFeedLabStoredUsers();

    setUsernames(storedUsers.map((user) => user.username));
    setUsernameByKeyId(
      Object.fromEntries(
        storedUsers.map((user) => [user.keyId, user.username]),
      ),
    );
  }, []);

  const addLocalUser = useCallback(
    (input: { keyId: string; username: string }) => {
      setUsernameByKeyId((prev) => ({
        ...prev,
        [input.keyId]: input.username,
      }));
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
