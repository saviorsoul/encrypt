import { afterEach, describe, expect, it } from 'vitest';
import { readConfig } from '../config.js';

const ENV_KEYS = ['VITE_FEED_INVITATIONAL_ONLY'] as const;

function restoreEnv(snapshot: Record<string, string | undefined>): void {
  for (const key of ENV_KEYS) {
    if (snapshot[key] === undefined) {
      delete process.env[key];
    } else {
      process.env[key] = snapshot[key];
    }
  }
}

describe('feedInvitationalOnly config', () => {
  const envSnapshot = Object.fromEntries(
    ENV_KEYS.map((key) => [key, process.env[key]]),
  );

  afterEach(() => {
    restoreEnv(envSnapshot);
  });

  it('defaults to true when unset', () => {
    delete process.env.VITE_FEED_INVITATIONAL_ONLY;

    expect(readConfig().feedInvitationalOnly).toBe(true);
  });

  it('parses false', () => {
    process.env.VITE_FEED_INVITATIONAL_ONLY = 'false';

    expect(readConfig().feedInvitationalOnly).toBe(false);
  });

  it('parses true', () => {
    process.env.VITE_FEED_INVITATIONAL_ONLY = 'true';

    expect(readConfig().feedInvitationalOnly).toBe(true);
  });

  it('rejects invalid values', () => {
    process.env.VITE_FEED_INVITATIONAL_ONLY = 'maybe';

    expect(() => readConfig()).toThrow('Invalid VITE_FEED_INVITATIONAL_ONLY');
  });
});
