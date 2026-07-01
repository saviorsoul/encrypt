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
