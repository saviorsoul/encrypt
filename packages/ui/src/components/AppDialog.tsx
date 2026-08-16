import CloseIcon from '@mui/icons-material/Close';
import Dialog, { type DialogProps } from '@mui/material/Dialog';
import DialogTitle from '@mui/material/DialogTitle';
import IconButton from '@mui/material/IconButton';
import Typography from '@mui/material/Typography';

const defaultBlockedCloseReasons = new Set(['backdropClick']);

export type AppDialogProps = DialogProps & {
  dismissOnBackdrop?: boolean;
  title?: string;
  closeDisabled?: boolean;
};

type AppDialogTitleProps = {
  title: string;
  onClose: DialogProps['onClose'];
  closeDisabled?: boolean;
};

function AppDialogTitle({
  title,
  onClose,
  closeDisabled = false,
}: AppDialogTitleProps) {
  return (
    <DialogTitle
      component="div"
      sx={{
        boxSizing: 'border-box',
        width: '100%',
        display: 'flex',
        alignItems: 'center',
        gap: 1,
        m: 0,
        px: 2,
        py: 1.5,
        flexShrink: 0,
      }}
    >
      <Typography
        variant="h6"
        component="span"
        sx={{ flex: 1, minWidth: 0, lineHeight: 1.3 }}
      >
        {title}
      </Typography>
      <IconButton
        aria-label="Close"
        onClick={(event) => onClose?.(event, 'escapeKeyDown')}
        disabled={closeDisabled}
        size="small"
        sx={{ flexShrink: 0 }}
      >
        <CloseIcon fontSize="small" />
      </IconButton>
    </DialogTitle>
  );
}

export function AppDialog({
  onClose,
  dismissOnBackdrop = false,
  title,
  closeDisabled = false,
  children,
  ...props
}: AppDialogProps) {
  const handleClose: DialogProps['onClose'] = (event, reason) => {
    if (
      !dismissOnBackdrop &&
      reason &&
      defaultBlockedCloseReasons.has(reason)
    ) {
      return;
    }
    onClose?.(event, reason);
  };

  return (
    <Dialog {...props} onClose={handleClose}>
      {title ? (
        <AppDialogTitle
          title={title}
          onClose={handleClose}
          closeDisabled={closeDisabled}
        />
      ) : null}
      {children}
    </Dialog>
  );
}

export type { DialogProps };
