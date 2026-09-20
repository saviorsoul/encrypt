function resolveApiBaseUrl(): string {
  const isCapacitor = Boolean(import.meta.env.VITE_CAPACITOR);

  if (import.meta.env.DEV && !isCapacitor) {
    return '';
  }

  const configured = import.meta.env.VITE_API_URL;
  if (typeof configured === 'string' && configured.length > 0) {
    return configured.replace(/\/$/, '');
  }

  if (isCapacitor) {
    throw new Error(
      'This app was built without VITE_API_URL. API requests cannot reach the server.',
    );
  }

  return '';
}

let cachedApiBaseUrl: string | undefined;

export function getApiBaseUrl(): string {
  cachedApiBaseUrl ??= resolveApiBaseUrl();
  return cachedApiBaseUrl;
}

export function getChallengeUrl(): string {
  const base = getApiBaseUrl();
  return base ? `${base}/api/auth/challenge` : '/api/auth/challenge';
}
