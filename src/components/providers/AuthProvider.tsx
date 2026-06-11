import React, {
  createContext,
  useCallback,
  useMemo,
  useState,
  type ReactNode,
} from 'react';

const STORAGE_KEY = 'social-fe-session-user';
export const LAST_USERNAME_STORAGE_KEY = 'social-fe-last-username';

export type AuthUser = { username: string };

export type AuthContextValue = {
  user: AuthUser | null;
  login: (username: string) => void;
  logout: () => void;
};

export const AuthContext = createContext<AuthContextValue | null>(null);

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<AuthUser | null>(() => {
    try {
      const stored = sessionStorage.getItem(STORAGE_KEY);
      if (!stored) return null;
      return { username: stored };
    } catch {
      return null;
    }
  });

  const login = useCallback((username: string) => {
    const trimmed = username.trim();
    if (!trimmed) return;
    setUser({ username: trimmed });
    try {
      sessionStorage.setItem(STORAGE_KEY, trimmed);
      localStorage.setItem(LAST_USERNAME_STORAGE_KEY, trimmed);
    } catch {
      /* ignore quota / privacy mode */
    }
  }, []);

  const logout = useCallback(() => {
    setUser(null);
    try {
      sessionStorage.removeItem(STORAGE_KEY);
    } catch {
      /* ignore */
    }
  }, []);

  const value = useMemo(() => ({ user, login, logout }), [user, login, logout]);

  return <AuthContext value={value}>{children}</AuthContext>;
}
