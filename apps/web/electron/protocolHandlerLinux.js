import { execFileSync } from 'node:child_process';

/** Matches apps/web/package.json build.desktopName + ".desktop". */
export const LINUX_PROTOCOL_DESKTOP_ENTRY = 'com.encrypt.app.desktop';

export const LINUX_PROTOCOL_SCHEME_MIME = 'x-scheme-handler/encrypt';

/**
 * @param {string} command
 * @param {string[]} args
 * @returns {string | null}
 */
function tryExecFile(command, args) {
  try {
    return execFileSync(command, args, { encoding: 'utf8' }).trim();
  } catch {
    return null;
  }
}

/**
 * @param {string | null | undefined} handler
 * @returns {boolean}
 */
export function isLinuxEncryptProtocolDefault(handler) {
  if (!handler) {
    return false;
  }

  const normalized = handler.trim();
  return (
    normalized === LINUX_PROTOCOL_DESKTOP_ENTRY ||
    normalized.endsWith(`/${LINUX_PROTOCOL_DESKTOP_ENTRY}`)
  );
}

/**
 * @returns {string | null}
 */
export function queryLinuxEncryptProtocolHandler() {
  return tryExecFile('xdg-mime', [
    'query',
    'default',
    LINUX_PROTOCOL_SCHEME_MIME,
  ]);
}

/**
 * @returns {boolean}
 */
export function isLinuxEncryptProtocolHandlerDefault() {
  return isLinuxEncryptProtocolDefault(queryLinuxEncryptProtocolHandler());
}

/**
 * Register Encrypt as the XDG default handler for encrypt:// on Linux.
 * Uses xdg-mime (works on Xfce and most DEs); xdg-settings is best-effort.
 *
 * @returns {boolean}
 */
export function restoreLinuxEncryptProtocolHandler() {
  try {
    execFileSync(
      'xdg-mime',
      ['default', LINUX_PROTOCOL_DESKTOP_ENTRY, LINUX_PROTOCOL_SCHEME_MIME],
      { stdio: 'ignore' },
    );
  } catch {
    return false;
  }

  tryExecFile('xdg-settings', [
    'set',
    'default-url-scheme-handler',
    'encrypt',
    LINUX_PROTOCOL_DESKTOP_ENTRY,
  ]);

  return isLinuxEncryptProtocolHandlerDefault();
}
