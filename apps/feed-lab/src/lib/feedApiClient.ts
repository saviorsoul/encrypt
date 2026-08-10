import { createFeedApi, type FeedApi } from '@encrypt/core/api/feedApi';

/**
 * API base URL for feed-lab HTTP clients.
 *
 * In dev, always use same-origin (empty base) so the Vite proxy serves /api from
 * the feed-lab host the browser opened (localhost, LAN IP, https://…:5174, etc.).
 * VITE_PROXY_TARGET configures where the dev server proxies those requests.
 *
 * In production builds, set VITE_API_URL when the API is on another origin.
 */
function resolveApiBaseUrl(): string {
  if (import.meta.env.DEV) {
    return '';
  }

  const configured = import.meta.env.VITE_API_URL;
  if (typeof configured === 'string' && configured.length > 0) {
    return configured.replace(/\/$/, '');
  }

  return '';
}

const apiBaseUrl = resolveApiBaseUrl();

export function getFeedApi(): FeedApi {
  return createFeedApi({ baseUrl: apiBaseUrl });
}

export function getApiBaseUrl(): string {
  return apiBaseUrl;
}
