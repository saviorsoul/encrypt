import Alert from '@mui/material/Alert';
import Button from '@mui/material/Button';
import { AppDialog } from '@/components/shared/AppDialog.tsx';
import DialogActions from '@mui/material/DialogActions';
import DialogContent from '@mui/material/DialogContent';
import DialogTitle from '@mui/material/DialogTitle';
import Stack from '@mui/material/Stack';
import Typography from '@mui/material/Typography';

type ExternalInvalidFileDialogProps = {
  fileName: string;
  error: string;
  onClose: () => void;
};

export function ExternalInvalidFileDialog({
  fileName,
  error,
  onClose,
}: ExternalInvalidFileDialogProps) {
  return (
    <AppDialog open fullWidth maxWidth="xs">
      <DialogTitle>Invalid JSON file</DialogTitle>
      <DialogContent>
        <Stack spacing={2} sx={{ pt: 0.5 }}>
          <Typography variant="body2" color="text.secondary">
            <Typography
              component="span"
              variant="body2"
              sx={{ fontWeight: 600 }}
            >
              {fileName}
            </Typography>{' '}
            is not a valid encrypted message, private key, or public key file.
          </Typography>
          <Alert severity="error">{error}</Alert>
        </Stack>
      </DialogContent>
      <DialogActions sx={{ px: 3, pb: 2 }}>
        <Button onClick={onClose}>Close</Button>
      </DialogActions>
    </AppDialog>
  );
}
