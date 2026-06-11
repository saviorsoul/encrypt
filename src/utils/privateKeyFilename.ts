/** Safe filename for a user's ECDH private key download. */
export function privateKeyDownloadFilename(username: string): string {
  const safe = username.trim().replace(/[^a-zA-Z0-9._-]+/g, '_') || 'user';
  return `${safe}-ecdh-private-key.json`;
}
