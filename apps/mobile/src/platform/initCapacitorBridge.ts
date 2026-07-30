import { Capacitor } from '@capacitor/core';
import { Directory, Encoding, Filesystem } from '@capacitor/filesystem';

export function initCapacitorBridge(): void {
  if (!Capacitor.isNativePlatform()) {
    return;
  }

  window.capacitorBridge = {
    saveTextFile: async (text: string, filename: string): Promise<string> => {
      const directory = Directory.Documents;

      await Filesystem.writeFile({
        path: filename,
        data: text,
        directory,
        encoding: Encoding.UTF8,
      });

      if (Capacitor.getPlatform() === 'android') {
        return `Documents/${filename}`;
      }

      if (Capacitor.getPlatform() === 'ios') {
        return `On My iPhone/Encrypt/Documents/${filename}`;
      }

      return `Documents/${filename}`;
    },
  };
}
