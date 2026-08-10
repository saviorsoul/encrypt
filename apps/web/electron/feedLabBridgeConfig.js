const DEFAULT_HOSTNAME = 'feednt.com';
const DEFAULT_DEV_HOSTNAME = 'localhost';

export const FEED_LAB_PROTOCOL_BRIDGE_DISABLED_MESSAGE =
  'Feed Lab protocol bridge is disabled. Use a private key file in the browser, or set VITE_FEED_LAB_PROTOCOL_BRIDGE=true to enable encrypt:// bridge.';

/**
 * @param {string} hostname
 * @returns {boolean}
 */
export function isPrivateLanHostname(hostname) {
  const normalized = hostname.toLowerCase();
  if (normalized === 'localhost' || normalized === '::1') {
    return true;
  }

  const match = /^(\d{1,3})\.(\d{1,3})\.(\d{1,3})\.(\d{1,3})$/.exec(normalized);
  if (!match) {
    return false;
  }

  const octets = match.slice(1).map((part) => Number(part));
  if (octets.some((value) => value > 255)) {
    return false;
  }

  const [a, b] = octets;
  if (a === 127 || a === 10) {
    return true;
  }
  if (a === 172 && b >= 16 && b <= 31) {
    return true;
  }
  if (a === 192 && b === 168) {
    return true;
  }

  return false;
}

/**
 * @param {string} hostname
 * @returns {boolean}
 */
export function isAllowedFeedLabCallbackHostname(hostname) {
  const config = getFeedLabBridgeConfig();
  const normalized = hostname.toLowerCase();
  return (
    config.allowedHostnames.has(normalized) || isPrivateLanHostname(normalized)
  );
}

/**
 * @param {string} hostname
 * @returns {boolean}
 */
export function isDevFeedLabCallbackHostname(hostname) {
  const config = getFeedLabBridgeConfig();
  const normalized = hostname.toLowerCase();
  return (
    config.devHostnames.has(normalized) || isPrivateLanHostname(normalized)
  );
}

/**
 * @param {ReturnType<typeof buildConfig>} config
 * @returns {string}
 */
function formatAllowedHostnameHint(config) {
  const listed = [...config.allowedHostnames];
  return `${listed.join(', ')}, or a private LAN address (192.168.x.x, 10.x.x.x)`;
}

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

function parseHostnameList(raw, fallback) {
  const value = raw?.trim() || fallback;
  return value
    .split(',')
    .map((entry) => entry.trim().toLowerCase())
    .filter(Boolean);
}

function buildConfig() {
  const hostname =
    readEnv('VITE_FEED_LAB_HOSTNAME')?.trim() || DEFAULT_HOSTNAME;
  const devHostnamesList = parseHostnameList(
    readEnv('VITE_FEED_LAB_DEV_HOSTNAME'),
    DEFAULT_DEV_HOSTNAME,
  );
  const hashRouter = parseBoolean(readEnv('VITE_FEED_LAB_HASH_ROUTER'), true);
  const protocolBridge = parseBoolean(
    readEnv('VITE_FEED_LAB_PROTOCOL_BRIDGE'),
    false,
  );

  const allowedHostnames = new Set(
    [hostname, ...devHostnamesList, '127.0.0.1'].map((value) =>
      value.toLowerCase(),
    ),
  );
  const devHostnames = new Set(
    [...devHostnamesList, '127.0.0.1'].map((value) => value.toLowerCase()),
  );

  return {
    hostname: hostname.toLowerCase(),
    devHostname: devHostnamesList[0] ?? DEFAULT_DEV_HOSTNAME,
    hashRouter,
    protocolBridge,
    allowedHostnames,
    devHostnames,
  };
}

export function isFeedLabProtocolBridgeEnabled() {
  return getFeedLabBridgeConfig().protocolBridge;
}

/** @type {ReturnType<typeof buildConfig> | null} */
let cachedConfig = null;

export function getFeedLabBridgeConfig() {
  if (!cachedConfig) {
    cachedConfig = buildConfig();
  }
  return cachedConfig;
}

export function resetFeedLabBridgeConfigForTests() {
  cachedConfig = null;
}

export { formatAllowedHostnameHint };
