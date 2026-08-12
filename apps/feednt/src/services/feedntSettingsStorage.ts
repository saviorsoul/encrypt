const SETTINGS_STORAGE_KEY = 'encrypt:feednt:settings';

export type FeedntColorMode = 'light' | 'dark';

export type FeedntSettings = {
  automateDecryption: boolean;
  colorMode: FeedntColorMode;
};

const DEFAULT_SETTINGS: FeedntSettings = {
  automateDecryption: true,
  colorMode: 'light',
};

function getSettingsStorage(): Storage | null {
  if (typeof localStorage === 'undefined') {
    return null;
  }
  return localStorage;
}

export function loadFeedntSettings(): FeedntSettings {
  const storage = getSettingsStorage();
  if (!storage) {
    return DEFAULT_SETTINGS;
  }

  try {
    const raw = storage.getItem(SETTINGS_STORAGE_KEY);
    if (!raw) {
      return DEFAULT_SETTINGS;
    }
    const parsed = JSON.parse(raw) as Partial<FeedntSettings>;
    return {
      automateDecryption:
        typeof parsed.automateDecryption === 'boolean'
          ? parsed.automateDecryption
          : DEFAULT_SETTINGS.automateDecryption,
      colorMode:
        parsed.colorMode === 'light' || parsed.colorMode === 'dark'
          ? parsed.colorMode
          : DEFAULT_SETTINGS.colorMode,
    };
  } catch {
    return DEFAULT_SETTINGS;
  }
}

export function saveFeedntSettings(settings: FeedntSettings): void {
  const storage = getSettingsStorage();
  if (!storage) {
    return;
  }

  try {
    storage.setItem(SETTINGS_STORAGE_KEY, JSON.stringify(settings));
  } catch (error) {
    console.warn('Failed to save Feednt settings.', error);
  }
}
