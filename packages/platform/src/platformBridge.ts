import type { PrivateKeySafeStorageBridge } from './types.ts';

type PlatformWindow = Window & {
  electron?: {
    privateKeySafeStorage?: PrivateKeySafeStorageBridge;
  };
  capacitorBridge?: {
    privateKeySafeStorage?: PrivateKeySafeStorageBridge;
  };
};

function platformWindow(): PlatformWindow {
  return window as PlatformWindow;
}

export function getPrivateKeySafeStorageBridge(): PrivateKeySafeStorageBridge | null {
  return (
    platformWindow().electron?.privateKeySafeStorage ??
    platformWindow().capacitorBridge?.privateKeySafeStorage ??
    null
  );
}

export function armPrivateKeySafeStorageBridgeSession(keyId: string): void {
  const bridge = getPrivateKeySafeStorageBridge();
  if (bridge?.armSession) {
    void bridge.armSession(keyId);
  }
}
