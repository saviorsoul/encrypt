/** Stub for browser web builds; real implementation lives in @encrypt/desktop. */
export function parseDeepLink() {
  return { ok: false, error: 'Deep links are unavailable in the browser build.' };
}
