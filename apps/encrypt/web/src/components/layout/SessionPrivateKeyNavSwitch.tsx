import { SessionPrivateKeyNavSwitch as WebSessionPrivateKeyNavSwitch } from '@/components/layout/WebSessionPrivateKeyNavSwitch.tsx';

/** Electron and Capacitor store private keys in OS secure storage; no web-style cache toggle. */
export function SessionPrivateKeyNavSwitch() {
  if (import.meta.env.VITE_ELECTRON || import.meta.env.VITE_CAPACITOR) {
    return null;
  }

  return <WebSessionPrivateKeyNavSwitch />;
}
