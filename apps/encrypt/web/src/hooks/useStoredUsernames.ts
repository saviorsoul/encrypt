import { useCallback, useEffect, useState } from 'react';
import { listStoredUsers } from '@/services/db/storedPublicKeys.ts';
import { useAuth } from '@/hooks/useAuth.ts';

export function useStoredUsernames() {
  const { user } = useAuth();
  const currentUsername = user?.username ?? null;

  const [storedUsers, setStoredUsers] = useState<
    Array<{ keyId: string; username: string }>
  >([]);
  const [usernames, setUsernames] = useState<string[]>([]);
  const [allUsernames, setAllUsernames] = useState<string[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const refresh = useCallback(async () => {
    const users = await listStoredUsers();
    const all = users.map((user) => user.username);
    setStoredUsers(users);
    setAllUsernames(all);
    const others = currentUsername
      ? all.filter((name) => name !== currentUsername)
      : all;
    setUsernames(others);
  }, [currentUsername]);

  useEffect(() => {
    let cancelled = false;

    async function load() {
      setLoading(true);
      setError(null);
      try {
        await refresh();
      } catch (e) {
        if (!cancelled) {
          setError(
            e instanceof Error ? e.message : 'Failed to load stored users.',
          );
          setStoredUsers([]);
          setUsernames([]);
          setAllUsernames([]);
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

  return { storedUsers, usernames, allUsernames, loading, error, refresh };
}
