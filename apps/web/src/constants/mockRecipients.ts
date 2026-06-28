/** Sentinel value for the mock-recipients option in recipient multi-selects. */
export const MOCK_RECIPIENTS_SELECTION = '__mock_recipients__';

export function formatMockRecipientsLabel(count: number): string {
  return `Mock users (${count})`;
}
