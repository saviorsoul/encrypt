export const ENCRYPT_PROTOCOL_DEEP_LINKS_DISABLED_MESSAGE =
  'encrypt:// deep links are disabled in this build.';

/**
 * @param {string} name
 * @returns {string | undefined}
 */
function readEnv(name) {
  if (typeof import.meta !== 'undefined' && import.meta.env?.[name]) {
    return import.meta.env[name];
  }
  if (typeof process !== 'undefined' && process.env?.[name]) {
    return process.env[name];
  }
  return undefined;
}

/**
 * @param {string | undefined} value
 * @param {boolean} defaultValue
 * @returns {boolean}
 */
function parseBoolean(value, defaultValue) {
  if (value === undefined || value === '') {
    return defaultValue;
  }
  return value === 'true' || value === '1';
}

function buildConfig() {
  return {
    deepLinksEnabled: parseBoolean(
      readEnv('VITE_ENCRYPT_PROTOCOL_DEEP_LINKS'),
      true,
    ),
  };
}

/** @type {ReturnType<typeof buildConfig> | null} */
let cachedConfig = null;

export function getEncryptProtocolConfig() {
  if (!cachedConfig) {
    cachedConfig = buildConfig();
  }
  return cachedConfig;
}

export function resetEncryptProtocolConfigForTests() {
  cachedConfig = null;
}

export function isEncryptProtocolDeepLinksEnabled() {
  return getEncryptProtocolConfig().deepLinksEnabled;
}

/**
 * @returns {{ ok: true } | { ok: false; error: string; silent: true }}
 */
export function rejectDisabledEncryptProtocolDeepLinks() {
  if (!isEncryptProtocolDeepLinksEnabled()) {
    return {
      ok: false,
      error: ENCRYPT_PROTOCOL_DEEP_LINKS_DISABLED_MESSAGE,
      silent: true,
    };
  }

  return { ok: true };
}
