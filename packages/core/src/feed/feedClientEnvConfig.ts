import { readViteEnvBoolean } from '../env/viteEnv.ts';

const FEED_INVITATIONAL_ONLY_ENV = 'VITE_FEED_INVITATIONAL_ONLY';

export type FeedClientEnvConfig = {
  /** True when keys must join via invitation before using protected feed APIs (default). */
  feedInvitationalOnly: boolean;
};

function buildFeedClientEnvConfig(): FeedClientEnvConfig {
  return {
    feedInvitationalOnly: readViteEnvBoolean(FEED_INVITATIONAL_ONLY_ENV, true, {
      onInvalid: 'throw',
    }),
  };
}

let cachedConfig: FeedClientEnvConfig | null = null;

export function getFeedClientEnvConfig(): FeedClientEnvConfig {
  if (!cachedConfig) {
    cachedConfig = buildFeedClientEnvConfig();
  }
  return cachedConfig;
}

/** @internal Test helper */
export function resetFeedClientEnvConfigForTests(): void {
  cachedConfig = null;
}
