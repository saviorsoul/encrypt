import { useEffect, useState } from 'react';
import { useLocation } from 'react-router-dom';
import {
  isFreshLogin,
  markOnboardingComplete,
  wasOnboardingComplete,
} from '@/components/providers/AuthProvider.tsx';
import {
  loadStoredPublicKeyMaterial,
  requiresPrivateKeyOnboarding,
} from '@/services/db/storedPublicKeys.ts';
import { useAuth } from '@/hooks/useAuth.ts';

export type PrivateKeyOnboardingGuardStatus =
  | 'loading'
  | 'required'
  | 'recovery'
  | 'complete'
  | 'error';

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

      if (!stored) {
        const isNewAccountSetup = isFreshLogin() && !wasOnboardingComplete();
        setStatus(isNewAccountSetup ? 'required' : 'recovery');
        return;
      }

      const nextStatus = requiresPrivateKeyOnboarding(stored)
        ? 'required'
        : 'complete';
      if (nextStatus === 'complete') {
        markOnboardingComplete();
      }
      setStatus(nextStatus);
    }

    void check().catch(() => {
      if (!cancelled) {
        setStatus('error');
      }
    });

    return () => {
      cancelled = true;
    };
  }, [username, location.pathname]);

  return status;
}
