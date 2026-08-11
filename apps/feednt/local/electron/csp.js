const META_INCOMPATIBLE_DIRECTIVES = new Set([
  'frame-ancestors',
  'report-uri',
  'report-to',
]);

const GOOGLE_FONTS_STYLE = 'https://fonts.googleapis.com';
const GOOGLE_FONTS_FONT = 'https://fonts.gstatic.com';

const DEV_CONNECT_SOURCES = [
  "'self'",
  'http://localhost:*',
  'https://localhost:*',
  'ws://localhost:*',
  'wss://localhost:*',
  'http://127.0.0.1:*',
  'https://127.0.0.1:*',
  'ws://127.0.0.1:*',
  'wss://127.0.0.1:*',
];

function parseApiConnectOrigin(apiUrl) {
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

function buildConnectSources({ isDevServer, apiUrl }) {
  if (isDevServer) {
    const sources = [...DEV_CONNECT_SOURCES];
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

function buildDirectives(options) {
  const baseDirectives = {
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

function serializeDirectives(directives) {
  return Object.entries(directives)
    .map(([name, sources]) => `${name} ${sources.join(' ')}`)
    .join('; ');
}

export function buildNetworkAppCsp(options) {
  return serializeDirectives(buildDirectives(options));
}

export function getFeedntElectronCsp(isDevServer) {
  const apiUrl = process.env.VITE_API_URL ?? '';
  return buildNetworkAppCsp({ isDevServer, apiUrl });
}
