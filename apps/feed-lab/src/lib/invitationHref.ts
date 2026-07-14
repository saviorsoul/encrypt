import { buildInvitationTokenPath } from '@encrypt/core/invite/invitationLink';

export function buildFeedLabInvitationHref(token: string): string {
  const path = buildInvitationTokenPath(token);
  if (import.meta.env.PROD) {
    return `${window.location.origin}${window.location.pathname}#${path}`;
  }
  return `${window.location.origin}${path}`;
}
