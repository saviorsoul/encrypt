import Alert from '@mui/material/Alert';
import Snackbar from '@mui/material/Snackbar';
import { feedSnackbarSx } from '../utils/feedSnackbar.ts';

export type MessageSharedSnackbarProps = {
  noticeKey: number;
  onClose: () => void;
};

export function MessageSharedSnackbar({
  noticeKey,
  onClose,
}: MessageSharedSnackbarProps) {
  return (
    <Snackbar
      key={noticeKey > 0 ? `message-shared-${noticeKey}` : 'message-shared'}
      open={noticeKey > 0}
      autoHideDuration={5000}
      onClose={onClose}
      anchorOrigin={{ vertical: 'top', horizontal: 'center' }}
      sx={feedSnackbarSx}
    >
      <Alert
        severity="success"
        variant="outlined"
        onClose={onClose}
        sx={{ width: '100%' }}
      >
        Message shared
      </Alert>
    </Snackbar>
  );
}
