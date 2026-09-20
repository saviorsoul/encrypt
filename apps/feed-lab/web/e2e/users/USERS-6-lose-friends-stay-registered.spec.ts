import {
  E2E_INVITER_PRIVATE_KEY_PATH,
  isE2eInviterSeeded,
  isUserRegistered,
  listFriendKeyIds,
} from '../fixtures/e2eDbSeed.ts';
import { authorizedApiRequest } from '../fixtures/apiAuth.ts';
import { formatEcPublicKeyText } from '@encrypt/core/crypto/ecPublicKey';
import { loginWithPrivateKeyAtPath } from '../fixtures/loginWithPrivateKey.ts';
import {
  isRegisteredEphemeralUserSeeded,
  loadRegisteredEphemeralUser,
} from '../fixtures/registeredEphemeralUser.ts';
import { expect, test } from '../fixtures/test.ts';

test.describe('USERS-6 — Lose friends but stay registered', () => {
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
        'Registered ephemeral user missing — run USERS-3 through USERS-5 first',
      );
    }
  });

  test('unfriend keeps user registered for public-key re-add', async ({
    browser,
    page,
  }) => {
    test.setTimeout(120_000);

    const registeredEphemeral = await loadRegisteredEphemeralUser();
    if (!registeredEphemeral) {
      test.skip(
        true,
        'Registered ephemeral key file missing — run USERS-3 first',
      );
      return;
    }

    await loginWithPrivateKeyAtPath(page, registeredEphemeral.filePath);
    await expect(
      page.getByTestId('feed-no-friends-guide-loading'),
    ).not.toBeVisible({ timeout: 15_000 });

    await test.step('unfriend every friend via API', async () => {
      const friendKeyIds = await listFriendKeyIds(registeredEphemeral.keyId);
      expect(friendKeyIds.length).toBeGreaterThan(0);

      for (const friendKeyId of friendKeyIds) {
        const response = await authorizedApiRequest({
          material: registeredEphemeral.material,
          method: 'DELETE',
          path: '/api/friendships',
          body: { friendKeyId },
        });
        expect(response.status).toBe(204);
      }

      expect(await listFriendKeyIds(registeredEphemeral.keyId)).toEqual([]);
      expect(await isUserRegistered(registeredEphemeral.keyId)).toBe(true);
    });

    await test.step('registered user with zero friends can still open feed', async () => {
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

      await page.getByTestId('nav-open-users').click();
      await expect(page.getByText(/Your friends \(0\)/)).toBeVisible({
        timeout: 15_000,
      });
      await page.getByRole('button', { name: 'Close users' }).click();
    });

    await test.step('inviter re-adds ephemeral by public key', async () => {
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
      await inviterPage.getByLabel('Name').fill('e2e re-added invitee');
      await inviterPage
        .getByLabel('Public key')
        .fill(formatEcPublicKeyText(registeredEphemeral.material.publicKey));
      await inviterPage.getByTestId('add-friend-send-request').click();

      await expect(inviterPage.getByText('Friend request sent.')).toBeVisible({
        timeout: 15_000,
      });
      await inviterPage.close();
    });

    await test.step('ephemeral accepts and regains messaging access', async () => {
      await loginWithPrivateKeyAtPath(page, registeredEphemeral.filePath);
      await page.getByTestId('nav-open-users').click();
      await page.getByRole('button', { name: 'Refresh users' }).click();
      await expect(page.getByText('Incoming requests')).toBeVisible({
        timeout: 15_000,
      });

      await page.getByTestId('users-accept-friend-request').click();
      await expect(
        page.getByRole('heading', { name: 'Accept friend request' }),
      ).toBeVisible();
      await page.getByLabel('Name').fill('e2e seeded inviter');
      await page.getByTestId('accept-friend-request-submit').click();

      await expect(
        page.getByRole('heading', { name: 'Accept friend request' }),
      ).not.toBeVisible({ timeout: 15_000 });
      await expect(page.getByText(/Your friends \(1\)/)).toBeVisible({
        timeout: 15_000,
      });

      await page.getByRole('button', { name: 'Close users' }).click();
      await expect(
        page.getByTestId('feed-no-friends-guide-loading'),
      ).not.toBeVisible({ timeout: 15_000 });
      await expect(page.getByTestId('feed-create-message')).toBeEnabled({
        timeout: 15_000,
      });
    });
  });
});
