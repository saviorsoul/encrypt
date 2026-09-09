/** Read a Vite `VITE_*` env var from `import.meta.env` or Node `process.env`. */
export function readViteEnv(name: string): string | undefined {
  if (typeof import.meta !== 'undefined') {
    const env = (import.meta as { env?: Record<string, string | undefined> })
      .env;
    const fromVite = env?.[name];
    if (typeof fromVite === 'string' && fromVite !== '') {
      return fromVite;
    }
  }
  if (typeof process !== 'undefined' && process.env?.[name]) {
    return process.env[name];
  }
  return undefined;
}

export type ParseViteEnvBooleanOptions = {
  /** When set, invalid values throw instead of returning `defaultValue`. */
  onInvalid?: 'throw' | 'default';
};

export function parseViteEnvBoolean(
  value: string | undefined,
  defaultValue: boolean,
  envName: string,
  options: ParseViteEnvBooleanOptions = {},
): boolean {
  if (value === undefined || value === '') {
    return defaultValue;
  }
  if (value === 'false' || value === '0') {
    return false;
  }
  if (value === 'true' || value === '1') {
    return true;
  }
  if (options.onInvalid === 'throw') {
    throw new Error(`Invalid ${envName}: ${value}`);
  }
  return defaultValue;
}

export function readViteEnvBoolean(
  name: string,
  defaultValue: boolean,
  options: ParseViteEnvBooleanOptions = {},
): boolean {
  return parseViteEnvBoolean(readViteEnv(name), defaultValue, name, options);
}
