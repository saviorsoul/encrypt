/** Query param when the notice opens in a new tab (hides Back). */
export const GDPR_STANDALONE_QUERY_PARAM = 'standalone';

export type GdprPageHrefOptions = {
  /** Open in a new tab; adds standalone param so Back stays hidden. */
  newTab?: boolean;
};

function formatGdprPageHref(
  url: URL,
  isDevServer: boolean,
  relativeHref: string,
): string {
  if (isDevServer) {
    return `${url.pathname}${url.search}`;
  }

  const fileName = relativeHref.replace(/^\.\//, '');
  return `./${fileName.split('?')[0]}${url.search}`;
}

/** Href to the statically generated GDPR notice (`public/gdpr.html`). */
export function gdprPageHref(options: GdprPageHrefOptions = {}): string {
  const { newTab = false } = options;
  const isDevServer = import.meta.env.DEV && !import.meta.env.VITE_ELECTRON;
  const relativeHref = `${import.meta.env.BASE_URL ?? './'}gdpr.html`;
  const href = isDevServer ? '/gdpr.html' : relativeHref;

  if (!newTab || typeof window === 'undefined') {
    return href;
  }

  const url = new URL(href, window.location.href);
  url.searchParams.set(GDPR_STANDALONE_QUERY_PARAM, '1');

  return formatGdprPageHref(url, isDevServer, relativeHref);
}

export type OpenGdprPageOptions = {
  newTab?: boolean;
};

export function openGdprPage(options: OpenGdprPageOptions = {}): void {
  const href = gdprPageHref(options.newTab ? { newTab: true } : {});
  if (options.newTab) {
    window.open(href, '_blank', 'noopener,noreferrer');
    return;
  }
  window.location.assign(href);
}
