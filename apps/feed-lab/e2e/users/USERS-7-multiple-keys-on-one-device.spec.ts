import { isE2eInviterSeeded, isUserRegistered } from '../fixtures/e2eDbSeed.ts';
import {
  loginWithPrivateKeyAtPath,
  logoutFromFeedLab,
} from '../fixtures/loginWithPrivateKey.ts';
import { writeTestPrivateKeyFile } from '../fixtures/testKeys.ts';
import {
  isRegisteredEphemeralUserSeeded,
  loadRegisteredEphemeralUser,
} from '../fixtures/registeredEphemeralUser.ts';
import { expect, test } from '../fixtures/test.ts';

test.describe('USERS-7 — Multiple keys on one device', () => {
  test.beforeAll(async () => {
    if (!(await isE2eInviterSeeded())) {
      test.skip(
        true,
        'E2e inviter not seeded — run npm run db:seed:e2e in apps/api',
      );
    }

    if (!(await isRegisteredEphemeralUserSeeded())) {
      test.skip(
        true,
        'Registered ephemeral user missing — run USERS-3 through USERS-6 first',
      );
    }
  });

  test('switching keys toggles registered vs unregistered UI', async ({
    page,
  }) => {
    test.setTimeout(90_000);

    const registeredEphemeral = await loadRegisteredEphemeralUser();
    if (!registeredEphemeral) {
      test.skip(
        true,
        'Registered ephemeral key file missing — run USERS-3 first',
      );
      return;
    }

    await test.step('registered ephemeral key shows registered feed', async () => {
      await loginWithPrivateKeyAtPath(page, registeredEphemeral.filePath);
      await expect(
        page.getByTestId('feed-no-friends-guide-loading'),
      ).not.toBeVisible({ timeout: 15_000 });
      await expect(
        page.getByTestId('feed-no-friends-guide-not-registered'),
      ).not.toBeVisible();
      await expect(page.getByTestId('feed-create-message')).toBeEnabled({
        timeout: 15_000,
      });
      expect(await isUserRegistered(registeredEphemeral.keyId)).toBe(true);
    });

    await test.step('fresh local key shows unregistered onboarding', async () => {
      await logoutFromFeedLab(page);
      const unregisteredKey = await writeTestPrivateKeyFile();
      await loginWithPrivateKeyAtPath(page, unregisteredKey.filePath);
      await expect(
        page.getByTestId('feed-no-friends-guide-loading'),
      ).not.toBeVisible({ timeout: 15_000 });
      await expect(
        page.getByTestId('feed-no-friends-guide-not-registered'),
      ).toBeVisible();
      await expect(page.getByTestId('feed-create-message')).toBeDisabled();
      expect(await isUserRegistered(unregisteredKey.keyId)).toBe(false);
    });

    await test.step('switching back to registered key restores registered feed', async () => {
      await logoutFromFeedLab(page);
      await loginWithPrivateKeyAtPath(page, registeredEphemeral.filePath);

      await expect(
        page.getByTestId('feed-no-friends-guide-loading'),
      ).not.toBeVisible({ timeout: 15_000 });
      await expect(
        page.getByTestId('feed-no-friends-guide-not-registered'),
      ).not.toBeVisible();
      await expect(page.getByTestId('feed-create-message')).toBeEnabled({
        timeout: 15_000,
      });
    });
  });
});
