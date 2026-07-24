import {
  DEFAULT_SETTINGS,
  loadSettings,
  saveSettings,
  type ExtensionSettings,
} from '../shared/settings.js';

const statusEl = document.getElementById('status');
const shortcutsLink = document.getElementById('shortcuts-link');

const fields = {
  enableEncryptSelection: document.getElementById(
    'enableEncryptSelection',
  ) as HTMLInputElement,
  enableImportSelection: document.getElementById(
    'enableImportSelection',
  ) as HTMLInputElement,
  enableCopyPublicKey: document.getElementById(
    'enableCopyPublicKey',
  ) as HTMLInputElement,
};

function readForm(): ExtensionSettings {
  return {
    enableEncryptSelection: fields.enableEncryptSelection.checked,
    enableImportSelection: fields.enableImportSelection.checked,
    enableCopyPublicKey: fields.enableCopyPublicKey.checked,
  };
}

function writeForm(settings: ExtensionSettings): void {
  fields.enableEncryptSelection.checked = settings.enableEncryptSelection;
  fields.enableImportSelection.checked = settings.enableImportSelection;
  fields.enableCopyPublicKey.checked = settings.enableCopyPublicKey;
}

async function persist(): Promise<void> {
  const settings = readForm();
  await saveSettings(settings);
  if (statusEl) {
    statusEl.textContent = 'Saved.';
  }
}

void loadSettings().then((settings) => {
  writeForm({ ...DEFAULT_SETTINGS, ...settings });
});

for (const el of Object.values(fields)) {
  el.addEventListener('change', () => {
    void persist();
  });
}

shortcutsLink?.addEventListener('click', (event) => {
  event.preventDefault();
  void chrome.tabs.create({ url: 'chrome://extensions/shortcuts' });
});
