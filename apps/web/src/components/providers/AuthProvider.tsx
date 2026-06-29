import React, {
  createContext,
  useCallback,
  useMemo,
  useState,
  type ReactNode,
} from 'react';

export const SESSION_USER_STORAGE_KEY = 'social-fe-session-user';
export const LAST_USERNAME_STORAGE_KEY = 'social-fe-last-username';
/** Set when the user explicitly signs in during this tab session. */
export const FRESH_LOGIN_STORAGE_KEY = 'social-fe-fresh-login';
export const ONBOARDING_COMPLETE_STORAGE_KEY = 'social-fe-onboarding-complete';

function persistLoginStorage(username: string): void {
  try {
    sessionStorage.setItem(SESSION_USER_STORAGE_KEY, username);
    sessionStorage.setItem(FRESH_LOGIN_STORAGE_KEY, '1');
    sessionStorage.removeItem(ONBOARDING_COMPLETE_STORAGE_KEY);
    localStorage.setItem(LAST_USERNAME_STORAGE_KEY, username);
  } catch {
    /* ignore quota / privacy mode */
  }
}

function clearSessionAuthStorage(): void {
  try {
    sessionStorage.removeItem(SESSION_USER_STORAGE_KEY);
    sessionStorage.removeItem(FRESH_LOGIN_STORAGE_KEY);
    sessionStorage.removeItem(ONBOARDING_COMPLETE_STORAGE_KEY);
  } catch {
    /* ignore quota / privacy mode */
  }
}

export function clearAuthStorage(): void {
  clearSessionAuthStorage();
  try {
    localStorage.removeItem(LAST_USERNAME_STORAGE_KEY);
  } catch {
    /* ignore quota / privacy mode */
  }
}

export function isFreshLogin(): boolean {
  try {
    return sessionStorage.getItem(FRESH_LOGIN_STORAGE_KEY) === '1';
  } catch {
    return false;
  }
}

export function wasOnboardingComplete(): boolean {
  try {
    return sessionStorage.getItem(ONBOARDING_COMPLETE_STORAGE_KEY) === '1';
  } catch {
    return false;
  }
}

export function markOnboardingComplete(): void {
  try {
    sessionStorage.setItem(ONBOARDING_COMPLETE_STORAGE_KEY, '1');
    sessionStorage.removeItem(FRESH_LOGIN_STORAGE_KEY);
  } catch {
    /* ignore quota / privacy mode */
  }
}

export type AuthUser = { username: string };

export type LoginOptions = {
  existingUser?: boolean;
};

export type AuthContextValue = {
  user: AuthUser | null;
  loginNotice: string | null;
  login: (username: string, options?: LoginOptions) => void;
  clearLoginNotice: () => void;
  logout: () => void;
};

export const AuthContext = createContext<AuthContextValue | null>(null);

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<AuthUser | null>(() => {
    try {
      const stored = sessionStorage.getItem(SESSION_USER_STORAGE_KEY);
      if (!stored) return null;
      return { username: stored };
    } catch {
      return null;
    }
  });
  const [loginNotice, setLoginNotice] = useState<string | null>(null);

  const login = useCallback((username: string, options?: LoginOptions) => {
    const trimmed = username.trim();
    if (!trimmed) return;
    setUser({ username: trimmed });
    setLoginNotice(
      options?.existingUser
        ? `User already exists in database, logged in as: ${trimmed}`
        : null,
    );
    persistLoginStorage(trimmed);
  }, []);

  const clearLoginNotice = useCallback(() => {
    setLoginNotice(null);
  }, []);

  const logout = useCallback(() => {
    setUser(null);
    setLoginNotice(null);
    clearSessionAuthStorage();
  }, []);

  const value = useMemo(
    () => ({ user, loginNotice, login, clearLoginNotice, logout }),
    [user, loginNotice, login, clearLoginNotice, logout],
  );

  return <AuthContext value={value}>{children}</AuthContext>;
}
