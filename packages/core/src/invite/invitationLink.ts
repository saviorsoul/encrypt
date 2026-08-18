export type ParsedInvitationRoute = {
  token: string;
};

const INVITATION_TOKEN_UUID_RE =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

/** Whether a string is a UUID v4 invitation token. */
export function isInvitationTokenUuid(token: string): boolean {
  return INVITATION_TOKEN_UUID_RE.test(token.trim());
}

/**
 * Parse invitation text from a scanned QR code. Only accepts a raw UUID v4
 * (not URLs or `/invite/:token` paths). Use for in-app camera scanning.
 */
export function parseScannedInvitationUuid(text: string): string | null {
  const trimmed = text.trim();
  if (!isInvitationTokenUuid(trimmed)) {
    return null;
  }
  return trimmed;
}

/**
 * Extract an invitation token from invitation link text: raw UUID, `/invite/:token`,
 * or a full URL containing that path (including hash routes). Not for QR scanning.
 */
export function parseInvitationTokenFromText(text: string): string | null {
  const trimmed = text.trim();
  if (!trimmed) {
    return null;
  }

  if (isInvitationTokenUuid(trimmed)) {
    return trimmed;
  }

  const fromBarePath = parseInvitationRoute(
    trimmed.startsWith('/') ? trimmed : `/${trimmed}`,
  );
  if (fromBarePath && isInvitationTokenUuid(fromBarePath.token)) {
    return fromBarePath.token;
  }

  try {
    const url = new URL(trimmed);
    const fromPath = parseInvitationRoute(url.pathname);
    if (fromPath && isInvitationTokenUuid(fromPath.token)) {
      return fromPath.token;
    }

    const hash = url.hash.replace(/^#/, '');
    if (hash) {
      const fromHash = parseInvitationRoute(
        hash.startsWith('/') ? hash : `/${hash}`,
      );
      if (fromHash && isInvitationTokenUuid(fromHash.token)) {
        return fromHash.token;
      }
    }
  } catch {
    /* not a URL */
  }

  return null;
}

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
