/** Trigger a browser download of plain text (e.g. JSON). */
export function downloadTextFile(text: string, filename: string): void {
  const blob = new Blob([text], { type: 'application/json;charset=utf-8' });
  const url = URL.createObjectURL(blob);
  const anchor = document.createElement('a');
  anchor.href = url;
  anchor.download = filename;
  anchor.rel = 'noopener';
  anchor.style.display = 'none';
  document.body.appendChild(anchor);
  anchor.click();
  document.body.removeChild(anchor);
  window.setTimeout(() => URL.revokeObjectURL(url), 1000);
}

/** Trigger a browser download of a JSON-serializable value. */
export function downloadJsonFile(value: unknown, filename: string): void {
  downloadTextFile(JSON.stringify(value, null, 2), filename);
}
