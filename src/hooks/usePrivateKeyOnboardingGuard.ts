import { useEffect, useState } from 'react';
import { useLocation } from 'react-router-dom';
import {
  loadStoredPublicKeyMaterial,
  requiresPrivateKeyOnboarding,
} from '@/crypto/storedPublicKeys.ts';
import { useAuth } from '@/hooks/useAuth.ts';

export type PrivateKeyOnboardingGuardStatus =
  | 'loading'
  | 'required'
  | 'complete';

/**
 * Reads IndexedDB on each navigation to decide whether the user must finish
 * private-key onboarding before using the app.
 */
export function usePrivateKeyOnboardingGuard(): PrivateKeyOnboardingGuardStatus {
  const { user } = useAuth();
  const location = useLocation();
  const [status, setStatus] =
    useState<PrivateKeyOnboardingGuardStatus>('loading');
  const [prevGuardKey, setPrevGuardKey] = useState('');

  const username = user?.username;
  const guardKey = `${username ?? ''}\0${location.pathname}`;

  if (guardKey !== prevGuardKey) {
    setPrevGuardKey(guardKey);
    if (!username) {
      setStatus('complete');
    } else {
      setStatus('loading');
    }
  }

  useEffect(() => {
    if (!username) {
      return;
    }

    let cancelled = false;

    async function check() {
      const stored = await loadStoredPublicKeyMaterial(username);
      if (cancelled) return;
      setStatus(requiresPrivateKeyOnboarding(stored) ? 'required' : 'complete');
    }

    void check().catch(() => {
      if (!cancelled) {
        setStatus('required');
      }
    });

    return () => {
      cancelled = true;
    };
  }, [username, location.pathname]);

  return status;
}
