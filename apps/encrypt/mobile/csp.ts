/** CSP for the Capacitor shell (no Trusted Types — WebView compatibility). */

const META_INCOMPATIBLE_DIRECTIVES = new Set([
  'frame-ancestors',
  'report-uri',
  'report-to',
]);

const BASE_DIRECTIVES = {
  'default-src': ["'self'"],
  'script-src': ["'self'"],
  'style-src': ["'self'", "'unsafe-inline'"],
  'img-src': ["'self'", 'data:'],
  'font-src': ["'self'", 'data:'],
  'connect-src': ["'self'"],
  'object-src': ["'none'"],
  'base-uri': ["'self'"],
  'form-action': ["'self'"],
  'frame-ancestors': ["'none'"],
  'manifest-src': ["'self'"],
};

const DEVELOPMENT_DIRECTIVES = {
  ...BASE_DIRECTIVES,
  'script-src': ["'self'", "'unsafe-eval'", "'unsafe-inline'"],
  'connect-src': [
    "'self'",
    'http://localhost:*',
    'ws://localhost:*',
    'http://127.0.0.1:*',
    'ws://127.0.0.1:*',
    'capacitor://localhost',
    'https://localhost',
  ],
};

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

export const PRODUCTION_META_CSP = serializeDirectives(
  withoutMetaIncompatibleDirectives(BASE_DIRECTIVES),
);
export const DEVELOPMENT_META_CSP = serializeDirectives(
  withoutMetaIncompatibleDirectives(DEVELOPMENT_DIRECTIVES),
);
