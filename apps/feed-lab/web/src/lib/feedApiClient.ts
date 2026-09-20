import { createFeedApi, type FeedApi } from '@encrypt/core/api/feedApi';

/**
 * API origin for feed-lab HTTP clients (scheme + host, no path).
 *
 * - Dev: empty string → same-origin; Vite proxies `/api/*` to the API container.
 * - Prod on a custom domain (e.g. test.feednt.com): empty → browser calls `/api/...`
 *   on the same host via the load balancer.
 * - Prod cross-origin: set `VITE_API_URL` to the API origin (e.g. https://api.example.com).
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

/** API origin only — paths always include `/api/...`. */
export function getApiBaseUrl(): string {
  return apiBaseUrl;
}

export function getChallengeUrl(): string {
  const base = getApiBaseUrl();
  return base ? `${base}/api/auth/challenge` : '/api/auth/challenge';
}
