export class FeedLabBridgeKeyMismatchError extends Error {
  readonly expectedKeyId: string;
  readonly actualKeyId: string;

  constructor(expectedKeyId: string, actualKeyId: string) {
    super('Feed Lab session key mismatch.');
    this.name = 'FeedLabBridgeKeyMismatchError';
    this.expectedKeyId = expectedKeyId;
    this.actualKeyId = actualKeyId;
  }
}

export function isFeedLabBridgeKeyMismatchError(
  error: unknown,
): error is FeedLabBridgeKeyMismatchError {
  return error instanceof FeedLabBridgeKeyMismatchError;
}

export function formatKeyIdPreview(keyId: string): string {
  if (keyId.length <= 12) {
    return keyId;
  }
  return `${keyId.slice(0, 8)}…${keyId.slice(-4)}`;
}
