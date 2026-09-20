import { expect, test } from '../fixtures/test.ts';
import { loginWithPrivateKeyFile } from '../fixtures/loginWithPrivateKey.ts';

test.describe('USERS-1 — Generate a new key locally', () => {
  test('loads a new private key and shows onboarding when not registered', async ({
    page,
  }) => {
    await loginWithPrivateKeyFile(page);

    await expect(
      page.getByTestId('feed-no-friends-guide-loading'),
    ).not.toBeVisible({ timeout: 15_000 });

    await expect(
      page.getByTestId('feed-no-friends-guide-not-registered'),
    ).toBeVisible();
  });
});
