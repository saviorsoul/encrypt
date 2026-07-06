export type ParsedInvitationRoute = {
  token: string;
};

/** Parse `/invite/:token` from a pathname. */
export function parseInvitationRoute(
  pathname: string,
): ParsedInvitationRoute | null {
  const segments = pathname.split('/').filter(Boolean);
  if (segments.length !== 2 || segments[0] !== 'invite') {
    return null;
  }

  const token = decodeURIComponent(segments[1] ?? '').trim();
  if (!token) {
    return null;
  }

  return { token };
}

/** Relative app path for a backend-backed invitation link. */
export function buildInvitationTokenPath(token: string): string {
  return `/invite/${encodeURIComponent(token)}`;
}
