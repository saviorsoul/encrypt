/** @typedef {'production' | 'development'} CspEnvironment */

/** Directives that only take effect in HTTP headers, not in <meta>. */
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

const PRODUCTION_DIRECTIVES = {
  ...BASE_DIRECTIVES,
  'require-trusted-types-for': ["'script'"],
  'trusted-types': ["'none'"],
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
  ],
};

/**
 * @param {Record<string, string[]>} directives
 * @returns {string}
 */
function serializeDirectives(directives) {
  return Object.entries(directives)
    .map(([name, sources]) => `${name} ${sources.join(' ')}`)
    .join('; ');
}

/**
 * @param {Record<string, string[]>} directives
 * @returns {Record<string, string[]>}
 */
function withoutMetaIncompatibleDirectives(directives) {
  return Object.fromEntries(
    Object.entries(directives).filter(
      ([name]) => !META_INCOMPATIBLE_DIRECTIVES.has(name),
    ),
  );
}

/** For HTTP response headers (Electron session handler). */
export const PRODUCTION_CSP = serializeDirectives(PRODUCTION_DIRECTIVES);
export const DEVELOPMENT_CSP = serializeDirectives(DEVELOPMENT_DIRECTIVES);

/** For <meta http-equiv="Content-Security-Policy"> (web builds). */
export const PRODUCTION_META_CSP = serializeDirectives(
  withoutMetaIncompatibleDirectives(PRODUCTION_DIRECTIVES),
);
export const DEVELOPMENT_META_CSP = serializeDirectives(
  withoutMetaIncompatibleDirectives(DEVELOPMENT_DIRECTIVES),
);

/**
 * @param {CspEnvironment} environment
 * @returns {string}
 */
export function getContentSecurityPolicy(environment) {
  return environment === 'development' ? DEVELOPMENT_CSP : PRODUCTION_CSP;
}
