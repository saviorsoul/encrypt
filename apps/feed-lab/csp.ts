/** Directives that only take effect in HTTP headers, not in <meta>. */
const META_INCOMPATIBLE_DIRECTIVES = new Set([
  'frame-ancestors',
  'report-uri',
  'report-to',
]);

const GOOGLE_FONTS_STYLE = 'https://fonts.googleapis.com';
const GOOGLE_FONTS_FONT = 'https://fonts.gstatic.com';

const DEV_CONNECT_SOURCES: readonly string[] = [
  "'self'",
  'http://localhost:*',
  'ws://localhost:*',
  'http://127.0.0.1:*',
  'ws://127.0.0.1:*',
];

type CspOptions = {
  isDevServer: boolean;
  /** VITE_API_URL at build/serve time; empty means same-origin proxy in dev. */
  apiUrl?: string;
};

function parseApiConnectOrigin(apiUrl: string | undefined): string | null {
  const trimmed = apiUrl?.trim();
  if (!trimmed) {
    return null;
  }

  try {
    return new URL(trimmed).origin;
  } catch {
    return null;
  }
}

function buildConnectSources({ isDevServer, apiUrl }: CspOptions): string[] {
  if (isDevServer) {
    const sources: string[] = [...DEV_CONNECT_SOURCES];
    const apiOrigin = parseApiConnectOrigin(apiUrl);
    if (apiOrigin && !sources.includes(apiOrigin)) {
      sources.push(apiOrigin);
    }
    return sources;
  }

  const sources = ["'self'"];
  const apiOrigin = parseApiConnectOrigin(apiUrl) ?? 'http://localhost:3000';
  if (!sources.includes(apiOrigin)) {
    sources.push(apiOrigin);
  }
  return sources;
}

function buildDirectives(options: CspOptions): Record<string, string[]> {
  const baseDirectives: Record<string, string[]> = {
    'default-src': ["'self'"],
    'script-src': ["'self'"],
    'style-src': ["'self'", "'unsafe-inline'", GOOGLE_FONTS_STYLE],
    'img-src': ["'self'", 'data:'],
    'font-src': ["'self'", 'data:', GOOGLE_FONTS_FONT],
    'connect-src': buildConnectSources(options),
    'object-src': ["'none'"],
    'base-uri': ["'self'"],
    'form-action': ["'self'"],
    'frame-ancestors': ["'none'"],
    'manifest-src': ["'self'"],
  };

  if (options.isDevServer) {
    return {
      ...baseDirectives,
      'script-src': ["'self'", "'unsafe-eval'", "'unsafe-inline'"],
    };
  }

  return {
    ...baseDirectives,
    'require-trusted-types-for': ["'script'"],
    'trusted-types': ["'none'"],
  };
}

function serializeDirectives(directives: Record<string, string[]>): string {
  return Object.entries(directives)
    .map(([name, sources]) => `${name} ${sources.join(' ')}`)
    .join('; ');
}

function withoutMetaIncompatibleDirectives(
  directives: Record<string, string[]>,
): Record<string, string[]> {
  return Object.fromEntries(
    Object.entries(directives).filter(
      ([name]) => !META_INCOMPATIBLE_DIRECTIVES.has(name),
    ),
  );
}

export function getContentSecurityPolicy(options: CspOptions): string {
  return serializeDirectives(buildDirectives(options));
}

/** For <meta http-equiv="Content-Security-Policy"> (Vite web builds). */
export function getMetaContentSecurityPolicy(options: CspOptions): string {
  return serializeDirectives(
    withoutMetaIncompatibleDirectives(buildDirectives(options)),
  );
}
