import type { Page } from '@playwright/test';

export async function acceptPrivateKeyViaFileChooser(
  page: Page,
  filePath: string,
  openFileChooser: () => Promise<void>,
): Promise<void> {
  const fileChooserPromise = page.waitForEvent('filechooser');
  await openFileChooser();
  const fileChooser = await fileChooserPromise;
  await fileChooser.setFiles(filePath);
}
