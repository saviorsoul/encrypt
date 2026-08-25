export type FeedLabBridgeConfig = {
  /** Canonical production Feed Lab hostname (e.g. feednt.com). */
  hostname: string;
  /** Additional dev hostname allowed for local feed-lab (e.g. localhost). */
  devHostname: string;
  /**
   * When true, feed-lab may use `encrypt://feed-pair` / `encrypt://feed-op` to
   * reach the Electron / Capacitor system app. Production-host callbacks must
   * then use hash routes (`#/bridge-callback`). Off by default (clipboard/file
   * key flows are safer).
   */
  protocolBridge: boolean;
  allowedHostnames: ReadonlySet<string>;
  devHostnames: ReadonlySet<string>;
};

export const FEED_LAB_PROTOCOL_BRIDGE_DISABLED_MESSAGE =
  'Feed Lab protocol bridge is disabled. Use a private key file in the browser, or set VITE_FEED_LAB_PROTOCOL_BRIDGE=true to enable encrypt:// bridge.';

const DEFAULT_HOSTNAME = 'feednt.com';
const DEFAULT_DEV_HOSTNAME = 'localhost';

/** RFC1918 + loopback hostnames for local/mobile dev (no per-IP env entry required). */
export function isPrivateLanHostname(hostname: string): boolean {
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

export function isAllowedFeedLabCallbackHostname(hostname: string): boolean {
  const config = getFeedLabBridgeConfig();
  const normalized = hostname.toLowerCase();
  return (
    config.allowedHostnames.has(normalized) || isPrivateLanHostname(normalized)
  );
}

export function isDevFeedLabCallbackHostname(hostname: string): boolean {
  const config = getFeedLabBridgeConfig();
  const normalized = hostname.toLowerCase();
  return (
    config.devHostnames.has(normalized) || isPrivateLanHostname(normalized)
  );
}

function formatAllowedHostnameHint(config: FeedLabBridgeConfig): string {
  const listed = [...config.allowedHostnames];
  return `${listed.join(', ')}, or a private LAN address (192.168.x.x, 10.x.x.x)`;
}

export { formatAllowedHostnameHint };

function parseBoolean(
  value: string | undefined,
  defaultValue: boolean,
): boolean {
  if (value === undefined || value === '') {
    return defaultValue;
  }
  return value === 'true' || value === '1';
}

function readEnv(name: string): string | undefined {
  if (typeof import.meta !== 'undefined') {
    const env = (import.meta as { env?: Record<string, string | undefined> })
      .env;
    const fromVite = env?.[name];
    if (typeof fromVite === 'string' && fromVite) {
      return fromVite;
    }
  }
  if (typeof process !== 'undefined' && process.env?.[name]) {
    return process.env[name];
  }
  return undefined;
}

function parseHostnameList(
  raw: string | undefined,
  fallback: string,
): string[] {
  const value = raw?.trim() || fallback;
  return value
    .split(',')
    .map((entry) => entry.trim().toLowerCase())
    .filter(Boolean);
}

function buildConfig(): FeedLabBridgeConfig {
  const hostname =
    readEnv('VITE_FEED_LAB_HOSTNAME')?.trim() || DEFAULT_HOSTNAME;
  const devHostnamesList = parseHostnameList(
    readEnv('VITE_FEED_LAB_DEV_HOSTNAME'),
    DEFAULT_DEV_HOSTNAME,
  );
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
    protocolBridge,
    allowedHostnames,
    devHostnames,
  };
}

export function isFeedLabProtocolBridgeEnabled(): boolean {
  return getFeedLabBridgeConfig().protocolBridge;
}

let cachedConfig: FeedLabBridgeConfig | null = null;

export function getFeedLabBridgeConfig(): FeedLabBridgeConfig {
  if (!cachedConfig) {
    cachedConfig = buildConfig();
  }
  return cachedConfig;
}

/** @internal Test helper */
export function resetFeedLabBridgeConfigForTests(): void {
  cachedConfig = null;
}

/** @deprecated Use getFeedLabBridgeConfig().hostname */
export function getFeedLabProductionHostname(): string {
  return getFeedLabBridgeConfig().hostname;
}
