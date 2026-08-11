import type { PlatformAdapter } from './types.ts';
import {
  withUploadedPrivateKey,
} from './privateKeyFile.ts';
import { clearSessionPrivateKeyStorage } from './sessionPrivateKeyStorage.ts';

export function createPlatformAdapter(): PlatformAdapter {
  return {
    privateKey: {
      withUploadedPrivateKey,
      clearStorage: clearSessionPrivateKeyStorage,
    },
  };
}
