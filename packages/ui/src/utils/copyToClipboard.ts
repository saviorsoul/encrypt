export async function copyTextToClipboard(text: string): Promise<void> {
  const electronWrite = (
    window as Window & {
      electron?: { writeTextToClipboard?: (value: string) => Promise<void> };
    }
  ).electron?.writeTextToClipboard;

  if (electronWrite) {
    await electronWrite(text);
    return;
  }

  await navigator.clipboard.writeText(text);
}
