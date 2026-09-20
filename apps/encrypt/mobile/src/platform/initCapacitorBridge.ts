import { initCapacitorBridge as initPlatformCapacitorBridge } from '@encrypt/platform/capacitor/initCapacitorBridge';

export function initCapacitorBridge(): void {
  initPlatformCapacitorBridge({
    storageKeyPrefix: 'encrypt-pk-',
    documentsPathLabel: 'On My iPhone/Encrypt/Documents',
  });
}
