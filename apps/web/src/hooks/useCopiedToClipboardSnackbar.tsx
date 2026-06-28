import { useCallback, useState } from 'react';
import type { CopiedToClipboardSnackbarProps } from '@/components/CopiedToClipboardSnackbar.tsx';
import { copyTextToClipboard } from '@/utils/copyToClipboard.ts';

type CopiedToClipboardSnackbarState = {
  open: boolean;
  key: number;
  severity: 'success' | 'error';
};

export type CopiedToClipboardSnackbarController = {
  copyAndNotify: (text: string) => Promise<void>;
  snackbarProps: CopiedToClipboardSnackbarProps;
};

export function useCopiedToClipboardSnackbar(): CopiedToClipboardSnackbarController {
  const [snackbar, setSnackbar] = useState<CopiedToClipboardSnackbarState>({
    open: false,
    key: 0,
    severity: 'success',
  });

  const closeSnackbar = useCallback(() => {
    setSnackbar((prev) => ({ ...prev, open: false }));
  }, []);

  const copyAndNotify = useCallback(async (text: string) => {
    try {
      await copyTextToClipboard(text);
      setSnackbar((prev) => ({
        open: true,
        key: prev.key + 1,
        severity: 'success',
      }));
    } catch {
      setSnackbar((prev) => ({
        open: true,
        key: prev.key + 1,
        severity: 'error',
      }));
    }
  }, []);

  return {
    copyAndNotify,
    snackbarProps: {
      open: snackbar.open,
      severity: snackbar.severity,
      onClose: closeSnackbar,
      snackbarKey: snackbar.key,
    },
  };
}
