export async function copyTextToClipboard(text: string): Promise<void> {
  if (window.electron?.writeTextToClipboard) {
    await window.electron.writeTextToClipboard(text);
    return;
  }

  await navigator.clipboard.writeText(text);
}
