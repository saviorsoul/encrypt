import { initCapacitorBridge } from '@encrypt/platform/capacitor/initCapacitorBridge';
import { createFeedntPlatformAdapter } from '@encrypt/platform/feednt';

initCapacitorBridge({
  storageKeyPrefix: 'feednt-pk-',
  documentsPathLabel: 'On My iPhone/Feednt/Documents',
});

export const platform = createFeedntPlatformAdapter();
