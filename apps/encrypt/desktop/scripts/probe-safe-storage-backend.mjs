import { app, safeStorage } from 'electron';

app.whenReady().then(() => {
  const hasGetter = typeof safeStorage.getSelectedStorageBackend === 'function';
  const backend = hasGetter ? safeStorage.getSelectedStorageBackend() : null;

  process.stdout.write(
    `${JSON.stringify({
      platform: process.platform,
      available: safeStorage.isEncryptionAvailable(),
      backend,
      hasGetter,
    })}\n`,
  );

  app.quit();
});
