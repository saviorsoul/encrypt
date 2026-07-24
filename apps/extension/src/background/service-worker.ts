import {
  assertDecryptTextLength,
  assertEncryptTextLength,
  buildCopyPublicKeyUrl,
  buildDecryptUrl,
  buildEncryptUrl,
} from '../shared/deepLinks.js';
import { readFormattedSelectionText } from '../shared/formattedSelectionText.js';
import {
  DEFAULT_SETTINGS,
  loadSettings,
  type ExtensionSettings,
} from '../shared/settings.js';

const MENU_ENCRYPT = 'encrypt-selection';
const MENU_IMPORT = 'import-selection';
const MENU_COPY_PUBLIC_KEY = 'copy-public-key';

const ACTION_TITLE = 'Encrypt';

function isRestrictedBrowserUrl(url: string | undefined): boolean {
  if (!url) {
    return true;
  }
  return /^(chrome|chrome-extension|chrome-search|devtools|edge|about|view-source):/i.test(
    url,
  );
}

async function tryInjectProtocolClick(
  tabId: number,
  protocolUrl: string,
): Promise<boolean> {
  try {
    await chrome.scripting.executeScript({
      target: { tabId },
      func: (href: string) => {
        const anchor = document.createElement('a');
        anchor.href = href;
        anchor.rel = 'noopener noreferrer';
        anchor.style.display = 'none';
        document.documentElement.appendChild(anchor);
        anchor.click();
        anchor.remove();
      },
      args: [protocolUrl],
    });
    return true;
  } catch {
    return false;
  }
}

async function openDeepLinkViaExtensionPage(url: string): Promise<void> {
  const handoffUrl = chrome.runtime.getURL(
    `open/open.html#${encodeURIComponent(url)}`,
  );
  await chrome.tabs.create({ url: handoffUrl, active: true });
}

/**
 * Prefer clicking encrypt:// inside the current page (no new tab). Fall back to
 * the extension handoff page on chrome:// and other restricted URLs.
 */
async function openDeepLink(
  url: string,
  tab?: chrome.tabs.Tab | null,
): Promise<void> {
  const candidate =
    tab?.id != null && !isRestrictedBrowserUrl(tab.url)
      ? tab
      : (
          await chrome.tabs.query({
            active: true,
            currentWindow: true,
          })
        )[0];

  if (
    candidate?.id != null &&
    !isRestrictedBrowserUrl(candidate.url) &&
    (await tryInjectProtocolClick(candidate.id, url))
  ) {
    return;
  }

  await openDeepLinkViaExtensionPage(url);
}

async function getActiveTab(): Promise<chrome.tabs.Tab | undefined> {
  const [tab] = await chrome.tabs.query({
    active: true,
    currentWindow: true,
  });
  return tab;
}

async function readTabSelection(tabId: number): Promise<string> {
  try {
    const results = await chrome.scripting.executeScript({
      target: { tabId },
      func: readFormattedSelectionText,
    });
    return results[0]?.result ?? '';
  } catch {
    return '';
  }
}

async function getActiveTabSelection(): Promise<string> {
  const tab = await getActiveTab();
  if (!tab?.id) {
    return '';
  }

  return readTabSelection(tab.id);
}

async function notify(message: string): Promise<void> {
  console.warn('[encrypt-extension]', message);
  await chrome.action.setBadgeText({ text: '!' });
  await chrome.action.setBadgeBackgroundColor({ color: '#b45309' });
  await chrome.action.setTitle({ title: message });
  setTimeout(() => {
    void chrome.action.setBadgeText({ text: '' });
    void chrome.action.setTitle({ title: ACTION_TITLE });
  }, 4000);
}

async function encryptSelection(
  selectionText: string,
  tab?: chrome.tabs.Tab | null,
): Promise<void> {
  const error = assertEncryptTextLength(selectionText);
  if (error) {
    await notify(error);
    return;
  }

  await openDeepLink(buildEncryptUrl(selectionText), tab);
}

async function decryptSelection(
  selectionText: string,
  tab?: chrome.tabs.Tab | null,
): Promise<void> {
  const error = assertDecryptTextLength(selectionText);
  if (error) {
    await notify(error);
    return;
  }
  await openDeepLink(buildDecryptUrl(selectionText), tab);
}

async function rebuildContextMenus(
  settings: ExtensionSettings = DEFAULT_SETTINGS,
): Promise<void> {
  await chrome.contextMenus.removeAll();

  if (settings.enableEncryptSelection) {
    chrome.contextMenus.create({
      id: MENU_ENCRYPT,
      title: 'Encrypt selection',
      contexts: ['selection'],
    });
  }

  if (settings.enableImportSelection) {
    chrome.contextMenus.create({
      id: MENU_IMPORT,
      title: 'Decrypt selection',
      contexts: ['selection'],
    });
  }

  if (settings.enableCopyPublicKey) {
    chrome.contextMenus.create({
      id: MENU_COPY_PUBLIC_KEY,
      title: 'Public key into clipboard',
      contexts: ['page', 'selection', 'editable'],
    });
  }
}

chrome.runtime.onInstalled.addListener(() => {
  void loadSettings().then((settings) => rebuildContextMenus(settings));
});

chrome.runtime.onStartup.addListener(() => {
  void loadSettings().then((settings) => rebuildContextMenus(settings));
});

chrome.storage.onChanged.addListener((changes, area) => {
  if (area !== 'sync') {
    return;
  }
  void loadSettings().then((settings) => rebuildContextMenus(settings));
  void changes;
});

chrome.contextMenus.onClicked.addListener((info, tab) => {
  void (async () => {
    const settings = await loadSettings();

    switch (info.menuItemId) {
      case MENU_ENCRYPT:
        if (settings.enableEncryptSelection && tab?.id != null) {
          const selection = await readTabSelection(tab.id);
          await encryptSelection(selection, tab);
        }
        break;
      case MENU_IMPORT:
        if (settings.enableImportSelection && tab?.id != null) {
          const selection = await readTabSelection(tab.id);
          await decryptSelection(selection, tab);
        }
        break;
      case MENU_COPY_PUBLIC_KEY:
        if (settings.enableCopyPublicKey) {
          await openDeepLink(buildCopyPublicKeyUrl(), tab);
        }
        break;
      default:
        break;
    }
  })();
});

chrome.commands.onCommand.addListener((command) => {
  void (async () => {
    const settings = await loadSettings();
    const tab = await getActiveTab();

    switch (command) {
      case 'encrypt-selection': {
        if (!settings.enableEncryptSelection) {
          return;
        }
        const selection = await getActiveTabSelection();
        await encryptSelection(selection, tab);
        break;
      }
      case 'import-selection': {
        if (!settings.enableImportSelection) {
          return;
        }
        const selection = await getActiveTabSelection();
        await decryptSelection(selection, tab);
        break;
      }
      case 'copy-public-key': {
        if (!settings.enableCopyPublicKey) {
          return;
        }
        await openDeepLink(buildCopyPublicKeyUrl(), tab);
        break;
      }
      default:
        break;
    }
  })();
});

chrome.action.onClicked.addListener(() => {
  void chrome.runtime.openOptionsPage();
});

void loadSettings().then((settings) => rebuildContextMenus(settings));
