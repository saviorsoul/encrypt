import { useCallback, useEffect, useState } from 'react';
import type { BackendUser } from '@encrypt/core/api/feedApi';
import { listFeedLabStoredUsers } from '@lab/services/db/storedUsers.ts';
import { useFeedApi } from '@lab/providers/FeedApiProvider.tsx';

export function useFeedLabUsers() {
  const api = useFeedApi();
  const [backendUsers, setBackendUsers] = useState<BackendUser[]>([]);
  const [usernames, setUsernames] = useState<string[]>([]);
  const [usernameByKeyId, setUsernameByKeyId] = useState<
    Record<string, string>
  >({});
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const refresh = useCallback(async () => {
    const [remoteUsers, storedUsers] = await Promise.all([
      api.getUsers(),
      listFeedLabStoredUsers(),
    ]);

    const registeredKeyIds = new Set(remoteUsers.map((user) => user.keyId));
    const namedUsers = storedUsers.filter((user) =>
      registeredKeyIds.has(user.keyId),
    );

    setBackendUsers(remoteUsers);
    setUsernames(namedUsers.map((user) => user.username));
    setUsernameByKeyId(
      Object.fromEntries(namedUsers.map((user) => [user.keyId, user.username])),
    );
  }, [api]);

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

  const addBackendUser = useCallback((user: BackendUser) => {
    setBackendUsers((prev) => {
      if (prev.some((entry) => entry.keyId === user.keyId)) {
        return prev;
      }
      return [...prev, user].sort((a, b) => a.keyId.localeCompare(b.keyId));
    });
  }, []);

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
          setBackendUsers([]);
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
    backendUsers,
    usernames,
    usernameByKeyId,
    loading,
    error,
    refresh,
    addBackendUser,
    addLocalUser,
  };
}
