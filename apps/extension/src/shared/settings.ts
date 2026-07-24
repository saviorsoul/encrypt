export type ExtensionSettings = {
  enableEncryptSelection: boolean;
  enableImportSelection: boolean;
  enableCopyPublicKey: boolean;
};

export const DEFAULT_SETTINGS: ExtensionSettings = {
  enableEncryptSelection: true,
  enableImportSelection: true,
  enableCopyPublicKey: true,
};

export async function loadSettings(): Promise<ExtensionSettings> {
  const stored = await chrome.storage.sync.get(DEFAULT_SETTINGS);
  return {
    enableEncryptSelection: Boolean(
      stored.enableEncryptSelection ?? DEFAULT_SETTINGS.enableEncryptSelection,
    ),
    enableImportSelection: Boolean(
      stored.enableImportSelection ?? DEFAULT_SETTINGS.enableImportSelection,
    ),
    enableCopyPublicKey: Boolean(
      stored.enableCopyPublicKey ?? DEFAULT_SETTINGS.enableCopyPublicKey,
    ),
  };
}

export async function saveSettings(settings: ExtensionSettings): Promise<void> {
  await chrome.storage.sync.set(settings);
}
