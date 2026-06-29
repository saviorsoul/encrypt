import { createFeedApi, type FeedApi } from '@encrypt/core/api/feedApi';

const DEFAULT_API_URL = 'http://localhost:3000';
const apiBaseUrl = import.meta.env.VITE_API_URL || DEFAULT_API_URL;

export function getFeedApi(): FeedApi {
  return createFeedApi({ baseUrl: apiBaseUrl });
}

export function getApiBaseUrl(): string {
  return apiBaseUrl;
}
