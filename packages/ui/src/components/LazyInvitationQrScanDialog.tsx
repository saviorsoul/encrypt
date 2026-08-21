import { lazy, Suspense } from 'react';
import CircularProgress from '@mui/material/CircularProgress';
import Dialog from '@mui/material/Dialog';
import type { InvitationQrScanDialogProps } from './InvitationQrScanDialog.tsx';

const InvitationQrScanDialog = lazy(() =>
  import('./InvitationQrScanDialog.tsx').then((module) => ({
    default: module.InvitationQrScanDialog,
  })),
);

function InvitationQrScanDialogFallback({
  open,
  onClose,
}: Pick<InvitationQrScanDialogProps, 'open' | 'onClose'>) {
  return (
    <Dialog open={open} onClose={onClose} fullWidth maxWidth="sm">
      <CircularProgress
        aria-label="Loading QR scanner"
        sx={{ display: 'block', m: 'auto', my: 6 }}
      />
    </Dialog>
  );
}

/** Loads the QR scanner UI and decoder chunks only while open. */
export function LazyInvitationQrScanDialog({
  open,
  onClose,
  onTokenScanned,
}: InvitationQrScanDialogProps) {
  if (!open) {
    return null;
  }

  return (
    <Suspense
      fallback={
        <InvitationQrScanDialogFallback open={open} onClose={onClose} />
      }
    >
      <InvitationQrScanDialog
        open={open}
        onClose={onClose}
        onTokenScanned={onTokenScanned}
      />
    </Suspense>
  );
}
