/** Trigger a browser download of plain text (e.g. JSON). */
export async function downloadTextFile(
  text: string,
  filename: string,
): Promise<string> {
  const saveTextFile = (
    window as Window & {
      capacitorBridge?: {
        saveTextFile?: (value: string, name: string) => Promise<string>;
      };
    }
  ).capacitorBridge?.saveTextFile;
  if (saveTextFile) {
    const location = await saveTextFile(text, filename);
    return `Saved to ${location}`;
  }

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

  return `Saved as ${filename}`;
}

/** Trigger a browser download of a JSON-serializable value. */
export async function downloadJsonFile(
  value: unknown,
  filename: string,
): Promise<string> {
  return downloadTextFile(JSON.stringify(value, null, 2), filename);
}
