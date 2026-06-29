export function base64ToBytes(b64: string): Uint8Array {
  if (typeof b64 !== 'string' || b64.length === 0) {
    throw new Error(
      `Invalid base64: expected non-empty string, got ${typeof b64}`,
    );
  }

  try {
    const binary = Buffer.from(b64, 'base64');
    return new Uint8Array(binary);
  } catch (error) {
    const message =
      error instanceof Error ? error.message : 'Base64 decode failed';
    throw new Error(`Invalid base64: ${message}`, { cause: error });
  }
}

export function bytesToBase64(bytes: Uint8Array): string {
  return Buffer.from(bytes).toString('base64');
}
