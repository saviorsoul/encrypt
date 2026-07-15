function parseCorsAllowedOrigins(raw: string | undefined): ReadonlySet<string> {
  if (!raw?.trim()) {
    return new Set();
  }

  return new Set(
    raw
      .split(',')
      .map((origin) => origin.trim())
      .filter(Boolean),
  );
}

const DEFAULT_CORS_PREFLIGHT_MAX_AGE_SECONDS = 86_400;

function parseCorsPreflightMaxAgeSeconds(raw: string | undefined): number {
  const value = Number(raw ?? DEFAULT_CORS_PREFLIGHT_MAX_AGE_SECONDS);
  if (!Number.isInteger(value) || value < 0) {
    throw new Error(`Invalid CORS_PREFLIGHT_MAX_AGE_SECONDS: ${raw ?? ''}`);
  }

  return value;
}

export function readConfig() {
  const port = Number(process.env.PORT ?? 3000);
  if (!Number.isInteger(port) || port < 1 || port > 65535) {
    throw new Error(`Invalid PORT: ${process.env.PORT ?? ''}`);
  }

  return {
    port,
    databaseUrl: process.env.DATABASE_URL ?? '',
    isDev: process.env.NODE_ENV !== 'production',
    corsAllowedOrigins: parseCorsAllowedOrigins(
      process.env.CORS_ALLOWED_ORIGINS,
    ),
    corsPreflightMaxAgeSeconds: parseCorsPreflightMaxAgeSeconds(
      process.env.CORS_PREFLIGHT_MAX_AGE_SECONDS,
    ),
  } as const;
}

export type AppConfig = ReturnType<typeof readConfig>;
