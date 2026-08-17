import { test as base, expect } from '@playwright/test';
import { mkdir } from 'node:fs/promises';
import { API_BASE_URL, isApiHealthy } from './apiStack.ts';
import {
  E2E_KEYS_DIR,
  REGISTERED_EPHEMERAL_PRIVATE_KEY_PATH,
} from './e2eKeysPath.ts';
import { writePrivateKeyFileAt, type TestPrivateKeyFile } from './testKeys.ts';

export type EphemeralPrivateKey = TestPrivateKeyFile;

export const test = base.extend<{
  apiReady: void;
  ephemeralPrivateKey: EphemeralPrivateKey;
}>({
  apiReady: [
    async ({}, useFixture) => {
      if (!(await isApiHealthy())) {
        test.skip(true, `API not reachable at ${API_BASE_URL}`);
      }
      await useFixture(undefined);
    },
    { auto: true },
  ],
  ephemeralPrivateKey: async ({}, useFixture) => {
    await mkdir(E2E_KEYS_DIR, { recursive: true });
    const ephemeralPrivateKey = await writePrivateKeyFileAt(
      REGISTERED_EPHEMERAL_PRIVATE_KEY_PATH,
    );
    await useFixture(ephemeralPrivateKey);
  },
});

export { expect };
