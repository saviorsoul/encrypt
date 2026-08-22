/** Query param carrying the URL to restore when leaving the GDPR notice. */
export const GDPR_RETURN_QUERY_PARAM = 'return';

export type GdprPageHrefOptions = {
  withReturnUrl?: boolean;
};

/** Href to the statically generated GDPR notice (`public/gdpr.html`). */
export function gdprPageHref(options: GdprPageHrefOptions = {}): string {
  const { withReturnUrl = false } = options;
  const isDevServer = import.meta.env.DEV && !import.meta.env.VITE_ELECTRON;
  const relativeHref = `${import.meta.env.BASE_URL ?? './'}gdpr.html`;
  const href = isDevServer ? '/gdpr.html' : relativeHref;

  if (!withReturnUrl || typeof window === 'undefined') {
    return href;
  }

  const url = new URL(href, window.location.href);
  url.searchParams.set(GDPR_RETURN_QUERY_PARAM, window.location.href);

  if (isDevServer) {
    return `${url.pathname}${url.search}`;
  }

  const fileName = relativeHref.replace(/^\.\//, '');
  return `./${fileName.split('?')[0]}${url.search}`;
}

export function openGdprPage(): void {
  window.location.assign(gdprPageHref({ withReturnUrl: true }));
}
