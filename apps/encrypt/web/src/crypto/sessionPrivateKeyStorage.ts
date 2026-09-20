import {
  cachePrivateKeyMaterial,
  clearSessionPrivateKeyMemory,
  clearSessionPrivateKeyStorage,
  getCachedPrivateKeyMaterial,
  setPrivateKeyMemoryCacheEnabled,
} from '@encrypt/platform/sessionPrivateKeyStorage';
import { isPrivateKeyMemoryCacheEnabled as readWebPreference } from '@/utils/sessionPrivateKeyPreference.ts';
import { isElectronApp } from '@/utils/isElectronApp.ts';
import { isCapacitorApp } from '@/utils/isCapacitorApp.ts';

setPrivateKeyMemoryCacheEnabled(
  isElectronApp() || isCapacitorApp() || readWebPreference(),
);

export {
  cachePrivateKeyMaterial,
  clearSessionPrivateKeyMemory,
  clearSessionPrivateKeyStorage,
  getCachedPrivateKeyMaterial,
  setPrivateKeyMemoryCacheEnabled,
};
