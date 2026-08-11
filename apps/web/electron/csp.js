/** @typedef {'production' | 'development'} EncryptCspEnvironment */

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

function serializeDirectives(directives) {
  return Object.entries(directives)
    .map(([name, sources]) => `${name} ${sources.join(' ')}`)
    .join('; ');
}

function withoutMetaIncompatibleDirectives(directives) {
  return Object.fromEntries(
    Object.entries(directives).filter(
      ([name]) => !META_INCOMPATIBLE_DIRECTIVES.has(name),
    ),
  );
}

export const ENCRYPT_PRODUCTION_CSP = serializeDirectives(PRODUCTION_DIRECTIVES);
export const ENCRYPT_DEVELOPMENT_CSP = serializeDirectives(
  DEVELOPMENT_DIRECTIVES,
);

export const ENCRYPT_PRODUCTION_META_CSP = serializeDirectives(
  withoutMetaIncompatibleDirectives(PRODUCTION_DIRECTIVES),
);
export const ENCRYPT_DEVELOPMENT_META_CSP = serializeDirectives(
  withoutMetaIncompatibleDirectives(DEVELOPMENT_DIRECTIVES),
);

/** @deprecated Use ENCRYPT_*_CSP exports */
export const PRODUCTION_CSP = ENCRYPT_PRODUCTION_CSP;
/** @deprecated Use ENCRYPT_*_CSP exports */
export const DEVELOPMENT_CSP = ENCRYPT_DEVELOPMENT_CSP;
/** @deprecated Use ENCRYPT_*_META_CSP exports */
export const PRODUCTION_META_CSP = ENCRYPT_PRODUCTION_META_CSP;
/** @deprecated Use ENCRYPT_*_META_CSP exports */
export const DEVELOPMENT_META_CSP = ENCRYPT_DEVELOPMENT_META_CSP;

export function buildEncryptCsp(environment) {
  return environment === 'development'
    ? ENCRYPT_DEVELOPMENT_CSP
    : ENCRYPT_PRODUCTION_CSP;
}

export function buildEncryptMetaCsp(environment) {
  return environment === 'development'
    ? ENCRYPT_DEVELOPMENT_META_CSP
    : ENCRYPT_PRODUCTION_META_CSP;
}

/** @deprecated Use buildEncryptCsp */
export function getContentSecurityPolicy(environment) {
  return buildEncryptCsp(environment);
}
