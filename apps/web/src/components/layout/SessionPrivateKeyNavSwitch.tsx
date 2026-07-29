import { SessionPrivateKeyNavSwitch as WebSessionPrivateKeyNavSwitch } from '@/components/layout/WebSessionPrivateKeyNavSwitch.tsx';

/** Electron stores private keys in the OS keychain; no web-style cache toggle. */
export function SessionPrivateKeyNavSwitch() {
  if (import.meta.env.VITE_ELECTRON) {
    return null;
  }

  return <WebSessionPrivateKeyNavSwitch />;
}
