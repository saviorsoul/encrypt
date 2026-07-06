export function formatCommentAuthorLabel(
  authorKeyId: string | null,
  usernameByKeyId: Record<string, string>,
): string {
  if (!authorKeyId) {
    return 'Unknown author';
  }

  const username = usernameByKeyId[authorKeyId];
  if (username) {
    return username;
  }

  return authorKeyId;
}

export function formatFriendListEntry(
  keyId: string,
  usernameByKeyId: Record<string, string>,
  invitationLabel?: string | null,
): { primary: string; secondary: string | null } {
  const username = invitationLabel?.trim() || usernameByKeyId[keyId];
  if (username) {
    return { primary: username, secondary: keyId };
  }
  return { primary: keyId, secondary: null };
}
