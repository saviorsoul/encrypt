import {
  ensureFriendship,
  getE2eOrphanFriendKeyId,
  isE2eInviterSeeded,
} from '../fixtures/e2eDbSeed.ts';
import { loginWithPrivateKeyAtPath } from '../fixtures/loginWithPrivateKey.ts';
import {
  isRegisteredEphemeralUserSeeded,
  loadRegisteredEphemeralUser,
} from '../fixtures/registeredEphemeralUser.ts';
import { expect, test } from '../fixtures/test.ts';

test.describe('USERS-5 — Registered user messaging', () => {
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
        'Registered ephemeral user missing — run USERS-3 and USERS-4 first',
      );
    }
  });

  test('registered user with friend can message, comment, and share', async ({
    page,
  }) => {
    test.setTimeout(120_000);

    const messageText = 'e2e registered user message';
    const commentText = 'e2e registered user comment';

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
    ).not.toBeVisible({
      timeout: 15_000,
    });
    await expect(page.getByTestId('feed-create-message')).toBeEnabled({
      timeout: 15_000,
    });

    await test.step('create message', async () => {
      await page.getByTestId('feed-create-message').click();
      await expect(page.getByTestId('send-message-dialog')).toBeVisible();

      const dialog = page.getByRole('dialog', { name: /Create message/ });
      const messageField = dialog.getByRole('textbox', { name: 'Message' });
      const sendButton = dialog
        .getByRole('button', { name: 'Send message' })
        .last();

      await messageField.click();
      await messageField.pressSequentially(messageText);
      await expect(sendButton).toBeEnabled({ timeout: 5_000 });
      await sendButton.click();

      await expect(dialog).not.toBeVisible({ timeout: 30_000 });
      await expect(page.getByText(messageText)).toBeVisible({
        timeout: 30_000,
      });
    });

    const messageCard = page
      .locator('div')
      .filter({ hasText: messageText })
      .first();

    await test.step('add comment', async () => {
      await messageCard.getByRole('button', { name: 'Comments' }).click();
      await expect(messageCard.getByPlaceholder('New comment')).toBeVisible({
        timeout: 15_000,
      });

      const commentField = messageCard.getByPlaceholder('New comment');
      await commentField.click();
      await commentField.pressSequentially(commentText);

      const addCommentButton = messageCard.getByRole('button', {
        name: 'Add comment',
      });
      await expect(addCommentButton).toBeEnabled({ timeout: 5_000 });
      await addCommentButton.click();

      await expect(page.getByText(commentText)).toBeVisible({
        timeout: 30_000,
      });
    });

    await test.step('share message', async () => {
      const orphanKeyId = await getE2eOrphanFriendKeyId([
        registeredEphemeral.keyId,
      ]);
      await ensureFriendship(registeredEphemeral.keyId, orphanKeyId);

      await loginWithPrivateKeyAtPath(page, registeredEphemeral.filePath);
      await expect(
        page.getByTestId('feed-no-friends-guide-loading'),
      ).not.toBeVisible({ timeout: 15_000 });
      await expect(page.getByText(messageText)).toBeVisible({
        timeout: 30_000,
      });

      const reloadedMessageCard = page
        .locator('div')
        .filter({ hasText: messageText })
        .first();
      await reloadedMessageCard
        .getByRole('button', { name: 'Comments' })
        .click();

      await reloadedMessageCard.getByRole('button', { name: 'Share' }).click();

      const shareDialog = page.getByRole('dialog', { name: /Share/ });
      await expect(shareDialog).toBeVisible({ timeout: 15_000 });

      const shareButton = shareDialog
        .getByRole('button', { name: 'Share' })
        .last();
      await expect(shareButton).toBeEnabled({ timeout: 15_000 });
      await shareButton.click();

      await expect(shareDialog).not.toBeVisible({ timeout: 30_000 });
      await expect(page.getByText('Message shared')).toBeVisible({
        timeout: 15_000,
      });
      await expect(
        reloadedMessageCard.getByText(/^Share created:/),
      ).toBeVisible({
        timeout: 15_000,
      });
    });
  });
});
