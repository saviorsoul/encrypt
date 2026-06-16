import { app, globalShortcut } from 'electron';
import fsPromises from 'node:fs/promises';
import path from 'node:path';

export const SHORTCUT_IDS = {
  IMPORT_ENCRYPTED_TEXT: 'import-encrypted-text',
};

export const DEFAULT_SHORTCUTS = {
  [SHORTCUT_IDS.IMPORT_ENCRYPTED_TEXT]: 'CommandOrControl+D',
};

/** @type {Record<string, () => void>} */
let actionHandlers = {};

/** @type {Record<string, string>} */
let currentShortcuts = { ...DEFAULT_SHORTCUTS };

/** @type {Record<string, boolean>} */
let registrationStatus = {};

function getShortcutsFilePath() {
  return path.join(app.getPath('userData'), 'keyboard-shortcuts.json');
}

/**
 * @param {unknown} value
 * @returns {value is Record<string, string>}
 */
function isShortcutMap(value) {
  if (typeof value !== 'object' || value === null || Array.isArray(value)) {
    return false;
  }

  return Object.values(value).every(
    (entry) => typeof entry === 'string' && entry.length > 0,
  );
}

async function loadShortcuts() {
  try {
    const raw = await fsPromises.readFile(getShortcutsFilePath(), 'utf8');
    const parsed = JSON.parse(raw);

    if (!isShortcutMap(parsed)) {
      return { ...DEFAULT_SHORTCUTS };
    }

    const merged = { ...DEFAULT_SHORTCUTS };
    for (const id of Object.keys(DEFAULT_SHORTCUTS)) {
      if (typeof parsed[id] === 'string' && parsed[id].length > 0) {
        merged[id] = parsed[id];
      }
    }

    return merged;
  } catch {
    return { ...DEFAULT_SHORTCUTS };
  }
}

async function saveShortcuts(shortcuts) {
  await fsPromises.writeFile(
    getShortcutsFilePath(),
    `${JSON.stringify(shortcuts, null, 2)}\n`,
    'utf8',
  );
}

function registerAllShortcuts() {
  globalShortcut.unregisterAll();
  registrationStatus = {};

  for (const [id, accelerator] of Object.entries(currentShortcuts)) {
    const handler = actionHandlers[id];
    if (!handler) {
      continue;
    }

    const registered = globalShortcut.register(accelerator, handler);
    registrationStatus[id] = registered;
    if (!registered) {
      console.warn(
        `Failed to register keyboard shortcut "${id}" (${accelerator}).`,
      );
    }
  }
}

/**
 * @param {string} accelerator
 */
function canRegisterAccelerator(accelerator) {
  const noop = () => {};
  const registered = globalShortcut.register(accelerator, noop);
  if (registered) {
    globalShortcut.unregister(accelerator);
  }
  return registered;
}

/**
 * @param {Record<string, () => void>} handlers
 */
export async function initKeyboardShortcuts(handlers) {
  actionHandlers = handlers;
  currentShortcuts = await loadShortcuts();
  registerAllShortcuts();
}

export function unregisterAllKeyboardShortcuts() {
  globalShortcut.unregisterAll();
}

export function getKeyboardShortcuts() {
  return { ...currentShortcuts };
}

export function getKeyboardShortcutsState() {
  return {
    shortcuts: getKeyboardShortcuts(),
    registration: { ...registrationStatus },
    sessionType: process.env.XDG_SESSION_TYPE ?? 'unknown',
  };
}

/**
 * @param {string} id
 * @param {string} accelerator
 */
export async function setKeyboardShortcut(id, accelerator) {
  if (!(id in DEFAULT_SHORTCUTS)) {
    throw new Error('Unknown shortcut.');
  }

  if (typeof accelerator !== 'string' || !accelerator.trim()) {
    throw new Error('Invalid shortcut.');
  }

  const normalizedAccelerator = accelerator.trim();
  globalShortcut.unregisterAll();

  if (!canRegisterAccelerator(normalizedAccelerator)) {
    registerAllShortcuts();
    throw new Error('Shortcut is already in use or invalid.');
  }

  currentShortcuts = {
    ...currentShortcuts,
    [id]: normalizedAccelerator,
  };
  await saveShortcuts(currentShortcuts);
  registerAllShortcuts();
  return getKeyboardShortcutsState();
}
