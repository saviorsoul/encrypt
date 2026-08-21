import { afterEach, describe, expect, it } from 'vitest';
import { readConfig } from '../config.js';

const ENV_KEYS = ['NODE_ENV', 'CROSS_ORIGIN_RESOURCE_POLICY'] as const;

function restoreEnv(snapshot: Record<string, string | undefined>): void {
  for (const key of ENV_KEYS) {
    if (snapshot[key] === undefined) {
      delete process.env[key];
    } else {
      process.env[key] = snapshot[key];
    }
  }
}

describe('crossOriginResourcePolicy config', () => {
  const envSnapshot = Object.fromEntries(
    ENV_KEYS.map((key) => [key, process.env[key]]),
  );

  afterEach(() => {
    restoreEnv(envSnapshot);
  });

  it('defaults to cross-origin in dev', () => {
    delete process.env.NODE_ENV;
    delete process.env.CROSS_ORIGIN_RESOURCE_POLICY;

    expect(readConfig().crossOriginResourcePolicy).toBe('cross-origin');
  });

  it('defaults to same-site in production', () => {
    process.env.NODE_ENV = 'production';
    delete process.env.CROSS_ORIGIN_RESOURCE_POLICY;

    expect(readConfig().crossOriginResourcePolicy).toBe('same-site');
  });

  it('allows explicit override', () => {
    process.env.NODE_ENV = 'production';
    process.env.CROSS_ORIGIN_RESOURCE_POLICY = 'cross-origin';

    expect(readConfig().crossOriginResourcePolicy).toBe('cross-origin');
  });
});
