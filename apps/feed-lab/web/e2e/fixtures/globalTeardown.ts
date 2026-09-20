import { clearRegisteredEphemeralUserFixture } from './registeredEphemeralUser.ts';

export default async function globalTeardown(): Promise<void> {
  await clearRegisteredEphemeralUserFixture();
}
