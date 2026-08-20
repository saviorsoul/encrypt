/** Href to the statically generated GDPR notice (`public/gdpr.html`). */
export function gdprPageHref(): string {
  if (import.meta.env.DEV) {
    return '/gdpr.html';
  }

  const base = import.meta.env.BASE_URL ?? './';
  return `${base}gdpr.html`;
}
