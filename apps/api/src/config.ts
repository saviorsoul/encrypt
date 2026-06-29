export function readConfig() {
  const port = Number(process.env.PORT ?? 3000);
  if (!Number.isInteger(port) || port < 1 || port > 65535) {
    throw new Error(`Invalid PORT: ${process.env.PORT ?? ''}`);
  }

  return {
    port,
    databaseUrl: process.env.DATABASE_URL ?? '',
  } as const;
}

export type AppConfig = ReturnType<typeof readConfig>;
