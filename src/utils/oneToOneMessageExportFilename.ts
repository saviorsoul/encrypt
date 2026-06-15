/** Safe download filename for an exported 1-to-1 encrypted message. */
export function oneToOneMessageExportFilename(
  timestamp: number,
  partyName: string,
): string {
  const safeParty =
    partyName.trim().replace(/[^a-zA-Z0-9._-]+/g, '_') || 'user';
  return `${timestamp}-${safeParty}-1to1.json`;
}
