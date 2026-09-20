import {
  E2E_INVITER_PRIVATE_KEY_PATH,
  isE2eInviterSeeded,
} from '../fixtures/e2eDbSeed.ts';
import { formatEcPublicKeyText } from '@encrypt/core/crypto/ecPublicKey';
import { loginWithPrivateKeyAtPath } from '../fixtures/loginWithPrivateKey.ts';
import {
  isRegisteredEphemeralUserSeeded,
  loadRegisteredEphemeralUser,
} from '../fixtures/registeredEphemeralUser.ts';
import { expect, test } from '../fixtures/test.ts';

test.describe('USERS-4 — Get invited by public key', () => {
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
        'Registered ephemeral user missing — run USERS-3 first in this worker',
      );
    }
  });

  test('registered user sends request to registered target public key', async ({
    browser,
  }) => {
    test.setTimeout(60_000);
    const registeredEphemeral = await loadRegisteredEphemeralUser();
    if (!registeredEphemeral) {
      test.skip(
        true,
        'Registered ephemeral key file missing — run USERS-3 first',
      );
      return;
    }

    await test.step('seeded friend sends request by public key', async () => {
      const inviterPage = await browser.newPage();
      await loginWithPrivateKeyAtPath(
        inviterPage,
        E2E_INVITER_PRIVATE_KEY_PATH,
      );

      await inviterPage.getByTestId('nav-open-users').click();
      await expect(inviterPage.getByTestId('users-add-friend')).toBeEnabled({
        timeout: 15_000,
      });

      await inviterPage.getByTestId('users-add-friend').click();
      await inviterPage.getByTestId('add-friend-public-key-tab').click();
      await inviterPage.getByLabel('Name').fill('e2e public-key invitee');
      await inviterPage
        .getByLabel('Public key')
        .fill(formatEcPublicKeyText(registeredEphemeral.material.publicKey));
      await inviterPage.getByTestId('add-friend-send-request').click();

      await expect(inviterPage.getByText('Friend request sent.')).toBeVisible({
        timeout: 15_000,
      });
      await inviterPage.close();
    });

    await test.step('ephemeral user accepts incoming request', async () => {
      const targetContext = await browser.newContext();
      const targetPage = await targetContext.newPage();
      await loginWithPrivateKeyAtPath(targetPage, registeredEphemeral.filePath);

      await targetPage.getByTestId('nav-open-users').click();
      await expect(targetPage.getByText('Incoming requests')).toBeVisible({
        timeout: 15_000,
      });

      await targetPage.getByTestId('users-accept-friend-request').click();
      await expect(
        targetPage.getByRole('heading', { name: 'Accept friend request' }),
      ).toBeVisible();
      await targetPage.getByLabel('Name').fill('e2e seeded inviter');
      await expect(
        targetPage.getByTestId('accept-friend-request-submit'),
      ).toBeEnabled();
      await targetPage.getByTestId('accept-friend-request-submit').click();

      await expect(
        targetPage.getByRole('heading', { name: 'Accept friend request' }),
      ).not.toBeVisible({ timeout: 15_000 });
      await expect(targetPage.getByText(/Your friends \(1\)/)).toBeVisible({
        timeout: 15_000,
      });

      await targetPage.getByRole('button', { name: 'Close users' }).click();
      await expect(
        targetPage.getByTestId('feed-no-friends-guide-loading'),
      ).not.toBeVisible({ timeout: 15_000 });
      await expect(targetPage.getByTestId('feed-create-message')).toBeEnabled({
        timeout: 15_000,
      });

      await targetContext.close();
    });
  });
});
