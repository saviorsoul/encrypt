import type { Page } from '@playwright/test';
import { acceptPrivateKeyViaFileChooser } from './choosePrivateKeyFile.ts';
import { writeTestPrivateKeyFile } from './testKeys.ts';

export async function acceptLoginGdprConsentIfRequired(
  page: Page,
): Promise<void> {
  const gdprConsent = page.getByTestId('login-gdpr-consent');
  if (await gdprConsent.isVisible()) {
    await gdprConsent.check();
  }
}

export async function loginWithPrivateKeyAtPath(
  page: Page,
  filePath: string,
): Promise<void> {
  await page.goto('/login');
  await acceptLoginGdprConsentIfRequired(page);
  await acceptPrivateKeyViaFileChooser(page, filePath, async () => {
    await page.getByTestId('login-choose-private-key-file').click();
  });
  await page.waitForURL(/\/feed/);
}

export async function loginWithPrivateKeyFile(page: Page) {
  const ephemeralPrivateKey = await writeTestPrivateKeyFile();
  await loginWithPrivateKeyAtPath(page, ephemeralPrivateKey.filePath);
  return ephemeralPrivateKey;
}

export async function logoutFromFeedLab(page: Page): Promise<void> {
  await page.getByRole('button', { name: 'Settings' }).click();
  await page.getByRole('menuitem', { name: 'Log out' }).click();
  await page.waitForURL(/\/login/);
}
