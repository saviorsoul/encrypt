export function base64ToBytes(b64: string): Uint8Array {
  if (typeof b64 !== 'string' || b64.length === 0) {
    throw new Error(
      `Invalid base64: expected non-empty string, got ${typeof b64}`,
    );
  }

  try {
    const binary = atob(b64);
    const bytes = new Uint8Array(binary.length);
    for (let i = 0; i < binary.length; i++) bytes[i] = binary.charCodeAt(i);
    return bytes;
  } catch (e) {
    const message = e instanceof Error ? e.message : 'Base64 decode failed';
    throw new Error(`Invalid base64: ${message}`, { cause: e });
  }
}

export function bytesToBase64(bytes: Uint8Array): string {
  const parts: string[] = [];
  const chunkSize = 8192;
  for (let i = 0; i < bytes.length; i += chunkSize) {
    const slice = bytes.subarray(i, i + chunkSize);
    let chunk = '';
    for (let j = 0; j < slice.length; j++)
      chunk += String.fromCharCode(slice[j]);
    parts.push(chunk);
  }
  return btoa(parts.join(''));
}

/** Base64url without padding (used for JWK thumbprints and similar). */
export function bytesToBase64Url(bytes: Uint8Array): string {
  return bytesToBase64(bytes)
    .replace(/\+/g, '-')
    .replace(/\//g, '_')
    .replace(/=+$/, '');
}
