function safeKeyDownloadStem(username: string): string {
  return username.trim().replace(/[^a-zA-Z0-9._-]+/g, '_') || 'user';
}

/** Safe filename for a user's ECDH private key download. */
export function privateKeyDownloadFilename(username: string): string {
  return `${safeKeyDownloadStem(username)}-ecdh-private-key.json`;
}

/** Safe filename for a user's ECDH public key download. */
export function publicKeyDownloadFilename(username: string): string {
  return `${safeKeyDownloadStem(username)}-ecdh-public-key.json`;
}

const PRIVATE_KEY_DOWNLOAD_SUFFIX = '-ecdh-private-key';
const MAX_USERNAME_FROM_FILENAME_LENGTH = 16;

/** Guess a username from a private key download filename. */
export function usernameFromPrivateKeyFilename(filename: string): string {
  const basename = filename.replace(/^.*[/\\]/, '').trim();
  if (!basename) return '';

  let stem = basename.replace(/\.(json|jwk)$/i, '');
  if (stem.endsWith(PRIVATE_KEY_DOWNLOAD_SUFFIX)) {
    stem = stem.slice(0, -PRIVATE_KEY_DOWNLOAD_SUFFIX.length);
  }

  stem = stem.trim();
  if (!stem) return '';

  const truncated = stem.slice(0, MAX_USERNAME_FROM_FILENAME_LENGTH);
  return truncated.charAt(0).toUpperCase() + truncated.slice(1).toLowerCase();
}
