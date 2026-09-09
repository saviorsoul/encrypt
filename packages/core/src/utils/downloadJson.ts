export type TextFileSaveResult = {
  outcome: 'saved' | 'started';
  message: string;
};

type SaveFilePickerWindow = Window & {
  showSaveFilePicker?: (options: {
    suggestedName?: string;
    types?: Array<{
      description: string;
      accept: Record<string, string[]>;
    }>;
  }) => Promise<FileSystemFileHandle>;
};

function triggerAnchorDownload(text: string, filename: string): void {
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

/**
 * Saves text to disk when the platform allows confirmation (native bridge or
 * save picker). Falls back to a programmatic download that may be blocked;
 * that path returns `outcome: 'started'` because completion cannot be verified.
 *
 * `prepareSave` runs while the caller still has transient user activation, before
 * any slow async work in `getText`.
 */
export async function saveTextFileWithConfirmation(
  filename: string,
  getText: () => Promise<string>,
): Promise<TextFileSaveResult> {
  const saveTextFile = (
    window as Window & {
      capacitorBridge?: {
        saveTextFile?: (value: string, name: string) => Promise<string>;
      };
    }
  ).capacitorBridge?.saveTextFile;
  if (saveTextFile) {
    const text = await getText();
    const location = await saveTextFile(text, filename);
    return { outcome: 'saved', message: `Saved to ${location}` };
  }

  const savePicker = (window as SaveFilePickerWindow).showSaveFilePicker;
  if (savePicker) {
    let handle: FileSystemFileHandle;
    try {
      handle = await savePicker({
        suggestedName: filename,
        types: [
          {
            description: 'JSON file',
            accept: { 'application/json': ['.json'] },
          },
        ],
      });
    } catch (error) {
      if (error instanceof DOMException && error.name === 'AbortError') {
        throw new Error('Save cancelled.');
      }
      throw error;
    }

    const text = await getText();
    const writable = await handle.createWritable();
    await writable.write(text);
    await writable.close();
    return { outcome: 'saved', message: `Saved as ${handle.name}` };
  }

  const text = await getText();
  triggerAnchorDownload(text, filename);
  return {
    outcome: 'started',
    message:
      'Download started. If no file appears, check whether your browser blocked downloads.',
  };
}

/** Trigger a browser download of plain text (e.g. JSON). */
export async function downloadTextFile(
  text: string,
  filename: string,
): Promise<string> {
  const result = await saveTextFileWithConfirmation(filename, async () => text);
  return result.message;
}

/** Trigger a browser download of a JSON-serializable value. */
export async function downloadJsonFile(
  value: unknown,
  filename: string,
): Promise<string> {
  return downloadTextFile(JSON.stringify(value, null, 2), filename);
}
