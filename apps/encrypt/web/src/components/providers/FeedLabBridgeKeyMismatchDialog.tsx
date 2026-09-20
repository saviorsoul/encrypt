import DialogActions from '@mui/material/DialogActions';
import DialogContent from '@mui/material/DialogContent';
import DialogTitle from '@mui/material/DialogTitle';
import Button from '@mui/material/Button';
import Typography from '@mui/material/Typography';
import { AppDialog } from '@/components/shared/AppDialog.tsx';
import { formatKeyIdPreview } from '@/utils/feedLabBridgeKeyMismatch.ts';

type FeedLabBridgeKeyMismatchDialogProps = {
  open: boolean;
  expectedKeyId: string;
  actualKeyId: string;
  onCancelAction: () => void;
  onChangeAccount: () => void;
};

export function FeedLabBridgeKeyMismatchDialog({
  open,
  expectedKeyId,
  actualKeyId,
  onCancelAction,
  onChangeAccount,
}: FeedLabBridgeKeyMismatchDialogProps) {
  return (
    <AppDialog open={open} onClose={onCancelAction} fullWidth maxWidth="sm">
      <DialogTitle>Wrong Encrypt account</DialogTitle>
      <DialogContent dividers>
        <Typography variant="body2" color="text.secondary" sx={{ mb: 2 }}>
          This Feed Lab request is paired with a different key than the account
          you signed in with. Sign in with the correct account or cancel the
          request.
        </Typography>
        <Typography variant="body2">
          Expected key:{' '}
          <Typography component="span" variant="body2" sx={{ fontFamily: 'monospace' }}>
            {formatKeyIdPreview(expectedKeyId)}
          </Typography>
        </Typography>
        <Typography variant="body2">
          Signed-in key:{' '}
          <Typography component="span" variant="body2" sx={{ fontFamily: 'monospace' }}>
            {formatKeyIdPreview(actualKeyId)}
          </Typography>
        </Typography>
      </DialogContent>
      <DialogActions>
        <Button onClick={onCancelAction}>Cancel Action</Button>
        <Button variant="contained" onClick={onChangeAccount}>
          Change account
        </Button>
      </DialogActions>
    </AppDialog>
  );
}
