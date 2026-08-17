import { expect, test } from '../fixtures/test.ts';
import { loginWithPrivateKeyFile } from '../fixtures/loginWithPrivateKey.ts';
import {
  authorizedApiRequest,
  buildMinimalCommentBody,
  buildMinimalCreateMessageBody,
  buildMinimalShareBody,
} from '../fixtures/apiAuth.ts';
import { generateTestKeyMaterial } from '../fixtures/testKeys.ts';

test.describe('USERS-2 — Authenticated but not registered', () => {
  test('shows onboarding guide and disables create message for unregistered key', async ({
    page,
  }) => {
    await loginWithPrivateKeyFile(page);

    await expect(
      page.getByTestId('feed-no-friends-guide-loading'),
    ).not.toBeVisible({ timeout: 15_000 });

    await expect(
      page.getByTestId('feed-no-friends-guide-not-registered'),
    ).toBeVisible();

    await expect(page.getByTestId('feed-create-message')).toBeDisabled();
    await expect(page.getByTestId('send-message-dialog')).not.toBeVisible();
  });

  test('rejects a schema-valid create message from an unregistered key', async () => {
    const material = await generateTestKeyMaterial();
    const body = buildMinimalCreateMessageBody(material.keyId, material);

    const response = await authorizedApiRequest({
      material,
      method: 'POST',
      path: '/api/messages',
      body,
    });

    expect(response.status).toBe(400);
    expect(response.body).toContain(`Unknown user keyId: ${material.keyId}`);
  });

  test('rejects a schema-valid comment from an unregistered key', async () => {
    const material = await generateTestKeyMaterial();
    const body = buildMinimalCommentBody(material);

    const response = await authorizedApiRequest({
      material,
      method: 'POST',
      path: '/api/comments',
      body,
    });

    expect(response.status).toBe(400);
    expect(response.body).toContain(`Unknown user keyId: ${material.keyId}`);
  });

  test('rejects a schema-valid share from an unregistered key', async () => {
    const material = await generateTestKeyMaterial();
    const body = buildMinimalShareBody(material);

    const response = await authorizedApiRequest({
      material,
      method: 'POST',
      path: '/api/shares',
      body,
    });

    expect(response.status).toBe(400);
    expect(response.body).toContain(`Unknown user keyId: ${material.keyId}`);
  });
});
