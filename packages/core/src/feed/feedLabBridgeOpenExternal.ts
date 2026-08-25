import {
  formatAllowedHostnameHint,
  getFeedLabBridgeConfig,
  isAllowedFeedLabCallbackHostname,
  isDevFeedLabCallbackHostname,
  resetFeedLabBridgeConfigForTests,
} from './feedLabBridgeConfig.ts';

const ALLOWED_SCHEMES = new Set(['http:', 'https:']);

export { getFeedLabBridgeConfig, resetFeedLabBridgeConfigForTests };

export function isAllowedFeedLabHostname(hostname: string): boolean {
  return isAllowedFeedLabCallbackHostname(hostname);
}

export function validateFeedLabHostname(url: URL): string | null {
  const config = getFeedLabBridgeConfig();
  const hostname = url.hostname.toLowerCase();

  if (!isAllowedFeedLabCallbackHostname(hostname)) {
    return `Feed Lab callback hostname must be ${formatAllowedHostnameHint(config)} (got ${hostname}).`;
  }

  if (hostname === config.hostname && url.protocol !== 'https:') {
    return 'Feed Lab production callbacks must use https.';
  }

  if (isDevFeedLabCallbackHostname(hostname)) {
    if (url.protocol !== 'http:' && url.protocol !== 'https:') {
      return 'Local Feed Lab callbacks must use http or https.';
    }
    return null;
  }

  return null;
}

/** Returns an error message, or null when the URL is valid. */
export function validateHttpExternalUrl(urlString: string): string | null {
  let url: URL;
  try {
    url = new URL(urlString.trim());
  } catch {
    return 'URL is invalid.';
  }

  if (!ALLOWED_SCHEMES.has(url.protocol)) {
    return 'Only http and https URLs are allowed.';
  }

  if (url.username || url.password) {
    return 'URLs with credentials are not allowed.';
  }

  return null;
}

export function feedLabBridgeCallbackRoutePath(url: URL): string {
  if (url.hash.startsWith('#/')) {
    return url.hash.slice(1).split('?')[0];
  }

  return url.pathname.replace(/\/$/, '') || '/';
}

export function validateFeedLabCallbackUrlShape(url: URL): string | null {
  const config = getFeedLabBridgeConfig();
  const hostname = url.hostname.toLowerCase();
  const path = feedLabBridgeCallbackRoutePath(url);

  if (hostname === config.hostname) {
    if (config.protocolBridge && !url.hash.startsWith('#/')) {
      return 'Feed Lab production callbacks must use hash routes (#/bridge-callback).';
    }

    if (config.protocolBridge) {
      const pathname = url.pathname.replace(/\/$/, '') || '';
      if (pathname && pathname !== '/') {
        return 'Feed Lab production callback URLs must be served from the site root.';
      }
    }

    if (path !== '/bridge-callback' && path !== '/bridge-callback/pair') {
      return 'Feed Lab callback route must be /bridge-callback or /bridge-callback/pair.';
    }

    return null;
  }

  if (isDevFeedLabCallbackHostname(hostname)) {
    if (path !== '/bridge-callback' && path !== '/bridge-callback/pair') {
      return 'Feed Lab callback route must be /bridge-callback or /bridge-callback/pair.';
    }

    return null;
  }

  return `Feed Lab callback hostname must be ${config.hostname}, ${config.devHostname}, or a private LAN address.`;
}

export function validateFeedLabBridgeCallbackPath(
  urlString: string,
  mode: 'pair' | 'op',
): string | null {
  const httpError = validateHttpExternalUrl(urlString);
  if (httpError) {
    return httpError;
  }

  const url = new URL(urlString.trim());
  const hostnameError = validateFeedLabHostname(url);
  if (hostnameError) {
    return hostnameError;
  }

  const shapeError = validateFeedLabCallbackUrlShape(url);
  if (shapeError) {
    return shapeError;
  }

  const path = feedLabBridgeCallbackRoutePath(url);

  if (mode === 'pair') {
    if (path !== '/bridge-callback/pair') {
      return 'Feed Lab pair callback must use a /bridge-callback/pair route.';
    }
    return null;
  }

  if (path !== '/bridge-callback') {
    return 'Feed Lab callback must use a /bridge-callback route.';
  }

  return null;
}

export function validateFeedLabBridgeOrigin(origin: string): string | null {
  const httpError = validateHttpExternalUrl(origin);
  if (httpError) {
    return httpError;
  }

  return validateFeedLabHostname(new URL(origin.trim()));
}

export function validateFeedLabBridgeCallbackOrigin(
  callbackUrl: string,
  expectedOrigin: string,
): string | null {
  const callbackError = validateFeedLabBridgeCallbackPath(callbackUrl, 'pair');
  if (callbackError) {
    return callbackError;
  }

  const originError = validateFeedLabBridgeOrigin(expectedOrigin);
  if (originError) {
    return originError;
  }

  let expected: URL;
  let callback: URL;
  try {
    expected = new URL(expectedOrigin.trim());
    callback = new URL(callbackUrl.trim());
  } catch {
    return 'Origin or callback URL is invalid.';
  }

  if (expected.origin !== callback.origin) {
    return 'Callback URL origin must match the Feed Lab origin.';
  }

  return null;
}

export function validateFeedLabPairCallback(
  callbackUrl: string,
  origin: string,
): string | null {
  const originError = validateFeedLabBridgeCallbackOrigin(callbackUrl, origin);
  if (originError) {
    return originError;
  }

  return validateFeedLabBridgeCallbackPath(callbackUrl, 'pair');
}

export function validateFeedLabOpenExternalUrl(urlString: string): string | null {
  const httpError = validateHttpExternalUrl(urlString);
  if (httpError) {
    return httpError;
  }

  const url = new URL(urlString.trim());
  const hostnameError = validateFeedLabHostname(url);
  if (hostnameError) {
    return hostnameError;
  }

  return validateFeedLabCallbackUrlShape(url);
}

export function assertSafeFeedLabOpenExternalUrl(urlString: string): void {
  const error = validateFeedLabOpenExternalUrl(urlString);
  if (error) {
    throw new Error(error);
  }
}

export type FeedLabBridgeOpenExternalMode = 'pair' | 'op';
