import { acceptPrivateKeyViaFileChooser } from '../fixtures/choosePrivateKeyFile.ts';
import { authorizedApiRequest } from '../fixtures/apiAuth.ts';
import {
  E2E_INVITER_PRIVATE_KEY_PATH,
  isE2eInviterSeeded,
} from '../fixtures/e2eDbSeed.ts';
import { loginWithPrivateKeyAtPath } from '../fixtures/loginWithPrivateKey.ts';
import { loadTestKeyMaterialFromFile } from '../fixtures/testKeys.ts';
import { expect, test } from '../fixtures/test.ts';

function invitationTokenFromHref(href: string): string {
  const match = href.match(/\/invite\/([^/?#]+)/);
  if (!match?.[1]) {
    throw new Error(`Could not parse invitation token from: ${href}`);
  }
  return match[1];
}

test.describe('USERS-3 — Get invited via link', () => {
  test.beforeAll(async () => {
    if (!(await isE2eInviterSeeded())) {
      test.skip(
        true,
        'E2e inviter not seeded — run npm run db:seed:e2e in apps/api',
      );
    }
  });

  test('invitee accepts invitation link and gains feed access', async ({
    browser,
    ephemeralPrivateKey,
  }) => {
    const invitationToken =
      await test.step('inviter creates invitation link', async () => {
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
        await inviterPage.getByLabel('Username').fill('e2e invitee');
        await inviterPage.getByTestId('add-friend-create-link').click();
        await expect(
          inviterPage.getByTestId('add-friend-invitation-link'),
        ).toBeVisible({
          timeout: 15_000,
        });

        const invitationHref = await inviterPage
          .getByRole('textbox', { name: 'Invitation link' })
          .inputValue();
        await inviterPage.close();
        return invitationTokenFromHref(invitationHref);
      });

    await test.step('invitee accepts invitation and opens feed', async () => {
      const inviteeContext = await browser.newContext();
      const inviteePage = await inviteeContext.newPage();

      await inviteePage.goto(`/invite/${invitationToken}`);
      await expect(inviteePage.getByText('Accept invitation')).toBeVisible({
        timeout: 15_000,
      });

      await acceptPrivateKeyViaFileChooser(
        inviteePage,
        ephemeralPrivateKey.filePath,
        async () => {
          await inviteePage
            .getByTestId('invite-use-private-key-to-accept')
            .click();
        },
      );

      await expect(inviteePage.getByText('Invitation accepted')).toBeVisible({
        timeout: 30_000,
      });

      await inviteePage.getByTestId('invite-open-feed').click();
      await inviteePage.waitForURL(/\/feed/);

      await expect(
        inviteePage.getByTestId('feed-no-friends-guide-not-registered'),
      ).not.toBeVisible({ timeout: 15_000 });
      await expect(
        inviteePage.getByTestId('feed-create-message'),
      ).toBeEnabled();

      await inviteeContext.close();
    });

    await test.step('unfriend invitee', async () => {
      const inviterMaterial = await loadTestKeyMaterialFromFile(
        E2E_INVITER_PRIVATE_KEY_PATH,
      );
      const unfriendResponse = await authorizedApiRequest({
        material: inviterMaterial,
        method: 'DELETE',
        path: '/api/friendships',
        body: { friendKeyId: ephemeralPrivateKey.keyId },
      });
      expect(unfriendResponse.status).toBe(204);
    });
  });
});
