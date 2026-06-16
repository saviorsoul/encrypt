export const IMPORT_ENCRYPTED_TEXT_SHORTCUT_ID = 'import-encrypted-text';

export const DEFAULT_KEYBOARD_SHORTCUTS = {
  [IMPORT_ENCRYPTED_TEXT_SHORTCUT_ID]: 'CommandOrControl+D',
} as const;

export type KeyboardShortcutId = keyof typeof DEFAULT_KEYBOARD_SHORTCUTS;

export type KeyboardShortcutsMap = Record<KeyboardShortcutId, string>;

export const KEYBOARD_SHORTCUT_DEFINITIONS: ReadonlyArray<{
  id: KeyboardShortcutId;
  label: string;
}> = [
  {
    id: IMPORT_ENCRYPTED_TEXT_SHORTCUT_ID,
    label: 'Import encrypted text',
  },
];

const SPECIAL_KEY_LABELS: Record<string, string> = {
  Space: 'Space',
  Tab: 'Tab',
  Enter: 'Enter',
  Escape: 'Esc',
  Backspace: 'Backspace',
  Delete: 'Delete',
  Insert: 'Insert',
  Home: 'Home',
  End: 'End',
  PageUp: 'Page Up',
  PageDown: 'Page Down',
  ArrowUp: 'Up',
  ArrowDown: 'Down',
  ArrowLeft: 'Left',
  ArrowRight: 'Right',
  Plus: '+',
  Minus: '-',
};

const MODIFIER_LABELS: Record<string, string> = {
  CommandOrControl: 'Ctrl',
  Command: 'Cmd',
  Control: 'Ctrl',
  Alt: 'Alt',
  Shift: 'Shift',
  Super: 'Super',
};

export type ShortcutPlatform =
  | 'aix'
  | 'android'
  | 'darwin'
  | 'freebsd'
  | 'linux'
  | 'openbsd'
  | 'sunos'
  | 'win32';

function formatShortcutKey(key: string): string {
  if (key in SPECIAL_KEY_LABELS) {
    return SPECIAL_KEY_LABELS[key];
  }

  if (/^F\d{1,2}$/.test(key)) {
    return key;
  }

  if (key.length === 1) {
    return key.toUpperCase();
  }

  return key;
}

export function formatAcceleratorForDisplay(
  accelerator: string,
  platform: ShortcutPlatform = 'linux',
): string {
  const parts = accelerator.split('+').filter(Boolean);
  if (parts.length === 0) {
    return accelerator;
  }

  const key = parts[parts.length - 1];
  const modifiers = parts.slice(0, -1);

  const modifierLabels = modifiers.map((modifier) => {
    if (modifier === 'CommandOrControl') {
      return platform === 'darwin' ? 'Cmd' : 'Ctrl';
    }

    return MODIFIER_LABELS[modifier] ?? modifier;
  });

  return [...modifierLabels, formatShortcutKey(key)].join(' + ');
}

const KEY_EVENT_TO_ACCELERATOR_KEY: Record<string, string> = {
  ' ': 'Space',
  '+': 'Plus',
  '-': 'Minus',
  ArrowUp: 'Up',
  ArrowDown: 'Down',
  ArrowLeft: 'Left',
  ArrowRight: 'Right',
};

export function keyEventToAccelerator(event: KeyboardEvent): string | null {
  const hasModifier =
    event.ctrlKey || event.metaKey || event.altKey || event.shiftKey;
  if (!hasModifier) {
    return null;
  }

  if (
    event.key === 'Escape' ||
    event.key === 'Control' ||
    event.key === 'Shift' ||
    event.key === 'Alt' ||
    event.key === 'Meta'
  ) {
    return null;
  }

  const parts: string[] = [];

  if (event.ctrlKey || event.metaKey) {
    parts.push('CommandOrControl');
  }
  if (event.altKey) {
    parts.push('Alt');
  }
  if (event.shiftKey) {
    parts.push('Shift');
  }

  let key = KEY_EVENT_TO_ACCELERATOR_KEY[event.key] ?? event.key;
  if (key.length === 1) {
    key = key.toUpperCase();
  }

  if (!key) {
    return null;
  }

  parts.push(key);
  return parts.join('+');
}

export function isElectronShortcutsAvailable(): boolean {
  return Boolean(import.meta.env.VITE_ELECTRON && window.electron);
}
