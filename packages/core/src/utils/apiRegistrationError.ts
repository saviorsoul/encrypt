/** True when an API error means the given keyId is not in the users table. */
export function isUnknownUserKeyIdError(
  message: string,
  keyId: string,
): boolean {
  return message.includes(`Unknown user keyId: ${keyId}`);
}
