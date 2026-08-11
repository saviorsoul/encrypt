function resolveApiBaseUrl(): string {
  const isCapacitor = Boolean(import.meta.env.VITE_CAPACITOR);

  if (import.meta.env.DEV && !isCapacitor) {
    return '';
  }

  const configured = import.meta.env.VITE_API_URL;
  if (typeof configured === 'string' && configured.length > 0) {
    return configured.replace(/\/$/, '');
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
