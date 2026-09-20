import { isBridgeCancellationError } from '@lab/crypto/systemAppSigner.ts';

export const FRIENDSHIP_REQUEST_CANCELLED_ERROR =
  'Friend request was cancelled.';

const SIGN_CANCELLED_ERROR = 'Network request signing was cancelled.';

export function isFriendshipRequestCancelledError(error: unknown): boolean {
  if (isBridgeCancellationError(error)) {
    return true;
  }
  const message = error instanceof Error ? error.message : String(error);
  return (
    message === FRIENDSHIP_REQUEST_CANCELLED_ERROR ||
    message === SIGN_CANCELLED_ERROR
  );
}

export function friendshipRequestErrorMessage(error: unknown): string {
  if (isFriendshipRequestCancelledError(error)) {
    return FRIENDSHIP_REQUEST_CANCELLED_ERROR;
  }
  return error instanceof Error ? error.message : 'Friendship request failed.';
}

export function isFriendshipOperationCancelledMessage(
  message: string | null | undefined,
): boolean {
  if (!message) {
    return false;
  }
  return isFriendshipRequestCancelledError(new Error(message));
}
