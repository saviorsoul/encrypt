import Dialog, { type DialogProps } from '@mui/material/Dialog';

const blockedCloseReasons = new Set(['backdropClick']);

export function AppDialog({ onClose, ...props }: DialogProps) {
  const handleClose: DialogProps['onClose'] = (event, reason) => {
    if (reason && blockedCloseReasons.has(reason)) {
      return;
    }
    onClose?.(event, reason);
  };

  return <Dialog {...props} onClose={handleClose} />;
}

export type { DialogProps };
