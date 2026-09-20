import { render, screen, fireEvent } from '@testing-library/react';
import { describe, expect, it, beforeEach, vi } from 'vitest';
import { AuthProvider } from '@/components/providers/AuthProvider.tsx';
import {
  cachePrivateKeyMaterial,
  getCachedPrivateKeyMaterial,
} from '@/crypto/sessionPrivateKeyStorage.ts';
import { setSessionPrivateKeyStorageEnabled } from '@/utils/sessionPrivateKeyPreference.ts';
import { useAuth } from '@/hooks/useAuth.ts';

const clearElectronSafeStoragePrivateKeys = vi.hoisted(() => vi.fn());

vi.mock('@/crypto/electronSafeStoragePrivateKey.ts', () => ({
  clearElectronSafeStoragePrivateKeys,
}));

function LogoutProbe() {
  const { login, logout } = useAuth();
  return (
    <div>
      <button type="button" onClick={() => login('alice')}>
        Log in
      </button>
      <button type="button" onClick={() => logout()}>
        Log out
      </button>
    </div>
  );
}

describe('AuthProvider logout', () => {
  beforeEach(() => {
    sessionStorage.clear();
    localStorage.clear();
    clearElectronSafeStoragePrivateKeys.mockClear();
    setSessionPrivateKeyStorageEnabled(true);
    cachePrivateKeyMaterial({
      keyId: 'test-key-id',
      publicKey: { x: 'x', y: 'y' },
      ecdhPrivateKey: {} as CryptoKey,
      ecdsaSignPrivateKey: {} as CryptoKey,
      senderPublicKey: {} as CryptoKey,
    });
  });

  it('clears cached private key material on logout', () => {
    render(
      <AuthProvider>
        <LogoutProbe />
      </AuthProvider>,
    );

    expect(getCachedPrivateKeyMaterial()).not.toBeNull();

    fireEvent.click(screen.getByRole('button', { name: 'Log out' }));

    expect(getCachedPrivateKeyMaterial()).toBeNull();
  });

  it('does not delete OS keychain entries on logout', () => {
    render(
      <AuthProvider>
        <LogoutProbe />
      </AuthProvider>,
    );

    fireEvent.click(screen.getByRole('button', { name: 'Log out' }));

    expect(clearElectronSafeStoragePrivateKeys).not.toHaveBeenCalled();
  });
});
