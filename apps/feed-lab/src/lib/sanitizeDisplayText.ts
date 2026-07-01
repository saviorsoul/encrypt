function isDisplayableChar(char: string): boolean {
  const code = char.charCodeAt(0);
  if (code === 0x09 || code === 0x0a || code === 0x0d) {
    return true;
  }
  return code >= 0x20 && code !== 0x7f;
}

/** Strip control characters unsuitable for UI display; keep tabs and newlines. */
export function sanitizeDisplayText(text: string): string {
  return [...text].filter(isDisplayableChar).join('');
}
