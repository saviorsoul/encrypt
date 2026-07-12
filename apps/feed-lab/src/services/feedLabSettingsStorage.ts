const SETTINGS_STORAGE_KEY = 'encrypt:feed-lab:settings';

export type FeedLabSettings = {
  requestsApprovalDialog: boolean;
};

const DEFAULT_SETTINGS: FeedLabSettings = {
  requestsApprovalDialog: true,
};

function getSettingsStorage(): Storage | null {
  if (typeof localStorage === 'undefined') {
    return null;
  }
  return localStorage;
}

export function loadFeedLabSettings(): FeedLabSettings {
  const storage = getSettingsStorage();
  if (!storage) {
    return DEFAULT_SETTINGS;
  }

  try {
    const raw = storage.getItem(SETTINGS_STORAGE_KEY);
    if (!raw) {
      return DEFAULT_SETTINGS;
    }
    const parsed = JSON.parse(raw) as Partial<FeedLabSettings>;
    return {
      requestsApprovalDialog:
        typeof parsed.requestsApprovalDialog === 'boolean'
          ? parsed.requestsApprovalDialog
          : DEFAULT_SETTINGS.requestsApprovalDialog,
    };
  } catch {
    return DEFAULT_SETTINGS;
  }
}

export function saveFeedLabSettings(settings: FeedLabSettings): void {
  const storage = getSettingsStorage();
  if (!storage) {
    return;
  }

  try {
    storage.setItem(SETTINGS_STORAGE_KEY, JSON.stringify(settings));
  } catch (error) {
    console.warn('Failed to save feed-lab settings.', error);
  }
}
