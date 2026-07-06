const STORAGE_KEY = 'feed-lab-sent-invitations';

export type FeedLabSentInvitation = {
  token: string;
  label: string;
  inviterKeyId: string;
  createdAt: string;
};

function parseSentInvitation(row: unknown): FeedLabSentInvitation | null {
  if (
    typeof row !== 'object' ||
    row === null ||
    typeof (row as { token?: unknown }).token !== 'string' ||
    typeof (row as { label?: unknown }).label !== 'string' ||
    typeof (row as { createdAt?: unknown }).createdAt !== 'string' ||
    typeof (row as { inviterKeyId?: unknown }).inviterKeyId !== 'string'
  ) {
    return null;
  }

  const record = row as {
    token: string;
    label: string;
    inviterKeyId: string;
    createdAt: string;
  };

  if (!record.label.trim() || !record.inviterKeyId) {
    return null;
  }

  return {
    token: record.token,
    label: record.label,
    inviterKeyId: record.inviterKeyId,
    createdAt: record.createdAt,
  };
}

function readStoredInvitations(): FeedLabSentInvitation[] {
  try {
    if (typeof localStorage === 'undefined') {
      return [];
    }
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) {
      return [];
    }
    const parsed: unknown = JSON.parse(raw);
    if (!Array.isArray(parsed)) {
      return [];
    }
    return parsed
      .map(parseSentInvitation)
      .filter((row): row is FeedLabSentInvitation => row !== null)
      .sort((a, b) => a.createdAt.localeCompare(b.createdAt));
  } catch {
    return [];
  }
}

function writeStoredInvitations(invitations: FeedLabSentInvitation[]): void {
  if (typeof localStorage === 'undefined') {
    return;
  }
  try {
    if (invitations.length === 0) {
      localStorage.removeItem(STORAGE_KEY);
      return;
    }
    localStorage.setItem(STORAGE_KEY, JSON.stringify(invitations));
  } catch {
    /* ignore quota / privacy mode */
  }
}

export async function saveSentInvitation(
  token: string,
  label: string,
  inviterKeyId: string,
): Promise<void> {
  const trimmedLabel = label.trim();
  const invitations = readStoredInvitations();
  const createdAt = new Date().toISOString();
  const existingIndex = invitations.findIndex(
    (invitation) => invitation.token === token,
  );

  const record: FeedLabSentInvitation = {
    token,
    label: trimmedLabel,
    inviterKeyId,
    createdAt:
      existingIndex >= 0
        ? invitations[existingIndex]!.createdAt
        : createdAt,
  };

  if (existingIndex >= 0) {
    invitations[existingIndex] = record;
  } else {
    invitations.push(record);
  }

  writeStoredInvitations(
    invitations.sort((a, b) => a.createdAt.localeCompare(b.createdAt)),
  );
}

export async function listSentInvitations(): Promise<FeedLabSentInvitation[]> {
  return readStoredInvitations();
}

/** Labels for friends the current user invited. Only valid when ownerKeyId is the inviter. */
export async function buildSentInvitationLabelByToken(
  ownerKeyId: string,
): Promise<Record<string, string>> {
  const invitations = await listSentInvitations();
  return Object.fromEntries(
    invitations
      .filter((invitation) => invitation.inviterKeyId === ownerKeyId)
      .map((invitation) => [invitation.token, invitation.label]),
  );
}
