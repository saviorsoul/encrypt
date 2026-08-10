import {
  formatAllowedHostnameHint,
  getFeedLabBridgeConfig,
  isAllowedFeedLabCallbackHostname,
  isDevFeedLabCallbackHostname,
  resetFeedLabBridgeConfigForTests,
} from './feedLabBridgeConfig.js';

const ALLOWED_SCHEMES = new Set(['http:', 'https:']);

export { getFeedLabBridgeConfig, resetFeedLabBridgeConfigForTests };

/**
 * @param {string} hostname
 * @returns {boolean}
 */
export function isAllowedFeedLabHostname(hostname) {
  return isAllowedFeedLabCallbackHostname(hostname);
}

/**
 * @param {URL} url
 * @returns {string | null}
 */
export function validateFeedLabHostname(url) {
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

/**
 * @param {string} urlString
 * @returns {string | null} Error message, or null when valid.
 */
export function validateHttpExternalUrl(urlString) {
  let url;
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

/**
 * @param {URL} url
 * @returns {string}
 */
export function feedLabBridgeCallbackRoutePath(url) {
  if (url.hash.startsWith('#/')) {
    return url.hash.slice(1).split('?')[0];
  }

  return url.pathname.replace(/\/$/, '') || '/';
}

/**
 * @param {URL} url
 * @returns {string | null}
 */
export function validateFeedLabCallbackUrlShape(url) {
  const config = getFeedLabBridgeConfig();
  const hostname = url.hostname.toLowerCase();
  const path = feedLabBridgeCallbackRoutePath(url);

  if (hostname === config.hostname) {
    if (config.hashRouter && !url.hash.startsWith('#/')) {
      return 'Feed Lab production callbacks must use hash routes (#/bridge-callback).';
    }

    if (config.hashRouter) {
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

/**
 * @param {string} urlString
 * @param {'pair' | 'op'} mode
 * @returns {string | null}
 */
export function validateFeedLabBridgeCallbackPath(urlString, mode) {
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

/**
 * @param {string} origin
 * @returns {string | null}
 */
export function validateFeedLabBridgeOrigin(origin) {
  const httpError = validateHttpExternalUrl(origin);
  if (httpError) {
    return httpError;
  }

  return validateFeedLabHostname(new URL(origin.trim()));
}

/**
 * @param {string} callbackUrl
 * @param {string} expectedOrigin
 * @returns {string | null}
 */
export function validateFeedLabBridgeCallbackOrigin(
  callbackUrl,
  expectedOrigin,
) {
  const callbackError = validateFeedLabBridgeCallbackPath(callbackUrl, 'pair');
  if (callbackError) {
    return callbackError;
  }

  const originError = validateFeedLabBridgeOrigin(expectedOrigin);
  if (originError) {
    return originError;
  }

  let expected;
  let callback;
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

/**
 * @param {string} callbackUrl
 * @param {string} origin
 * @returns {string | null}
 */
export function validateFeedLabPairCallback(callbackUrl, origin) {
  const originError = validateFeedLabBridgeCallbackOrigin(callbackUrl, origin);
  if (originError) {
    return originError;
  }

  return validateFeedLabBridgeCallbackPath(callbackUrl, 'pair');
}

/**
 * @param {string} urlString
 * @returns {string | null}
 */
export function validateFeedLabOpenExternalUrl(urlString) {
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

/**
 * @param {string} urlString
 */
export function assertSafeFeedLabOpenExternalUrl(urlString) {
  const error = validateFeedLabOpenExternalUrl(urlString);
  if (error) {
    throw new Error(error);
  }
}
