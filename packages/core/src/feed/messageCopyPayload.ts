export function assembleMessageCopyPayloadFromWire(
  messageId: string,
  wireBody: Record<string, unknown>,
): string {
  return JSON.stringify({ messageId, ...wireBody });
}
