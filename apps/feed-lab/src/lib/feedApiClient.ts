import { createFeedApi, type FeedApi } from '@encrypt/core/api/feedApi';

/**
 * In dev, default to same-origin (empty base) so Vite proxies /api and the
 * browser can read X-Next-Nonce without cross-origin header restrictions.
 * Set VITE_API_URL=http://localhost:3000 to call the API directly instead.
 */
function resolveApiBaseUrl(): string {
  const configured = import.meta.env.VITE_API_URL;
  if (typeof configured === 'string' && configured.length > 0) {
    return configured;
  }
  if (import.meta.env.DEV) {
    return '';
  }
  return 'http://localhost:3000';
}

const apiBaseUrl = resolveApiBaseUrl();

export function getFeedApi(): FeedApi {
  return createFeedApi({ baseUrl: apiBaseUrl });
}

export function getApiBaseUrl(): string {
  return apiBaseUrl;
}
