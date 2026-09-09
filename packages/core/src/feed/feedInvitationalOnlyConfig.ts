import { getFeedClientEnvConfig } from './feedClientEnvConfig.ts';

/** True when keys must join via invitation before using protected feed APIs (default). */
export function isFeedInvitationalOnlyEnabled(): boolean {
  return getFeedClientEnvConfig().feedInvitationalOnly;
}
