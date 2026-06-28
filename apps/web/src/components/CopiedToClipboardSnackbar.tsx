import Alert from '@mui/material/Alert';
import Snackbar from '@mui/material/Snackbar';

export const COPIED_TO_CLIPBOARD_SNACKBAR_MS = 5000;
export const COPIED_TO_CLIPBOARD_MESSAGE = 'Copied to clipboard';
export const COPY_TO_CLIPBOARD_FAILED_MESSAGE = 'Failed to copy to clipboard';

export type CopiedToClipboardSnackbarProps = {
  open: boolean;
  severity: 'success' | 'error';
  onClose: () => void;
  snackbarKey: number;
  successMessage?: string;
  errorMessage?: string;
};

export function CopiedToClipboardSnackbar({
  open,
  severity,
  onClose,
  snackbarKey,
  successMessage = COPIED_TO_CLIPBOARD_MESSAGE,
  errorMessage = COPY_TO_CLIPBOARD_FAILED_MESSAGE,
}: CopiedToClipboardSnackbarProps) {
  return (
    <Snackbar
      key={`copied-to-clipboard-${snackbarKey}`}
      open={open}
      autoHideDuration={COPIED_TO_CLIPBOARD_SNACKBAR_MS}
      onClose={onClose}
      anchorOrigin={{ vertical: 'top', horizontal: 'center' }}
    >
      <Alert
        severity={severity}
        variant="filled"
        onClose={onClose}
        sx={{ width: '100%' }}
      >
        {severity === 'success' ? successMessage : errorMessage}
      </Alert>
    </Snackbar>
  );
}
