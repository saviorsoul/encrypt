import { buildInvitationTokenPath } from '@encrypt/core/invite/invitationLink';

export function buildFeedLabInvitationHref(token: string): string {
  const path = buildInvitationTokenPath(token);
  return `${window.location.origin}${path}`;
}
