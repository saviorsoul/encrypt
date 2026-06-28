/** Pretty-print JSON text for display; returns the original text if parsing fails. */
export function prettifyJsonText(text: string): string {
  const trimmed = text.trim();
  if (!trimmed) {
    return text;
  }

  try {
    return JSON.stringify(JSON.parse(trimmed), null, 2);
  } catch {
    return text;
  }
}
