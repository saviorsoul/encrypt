import Alert from '@mui/material/Alert';
import Snackbar from '@mui/material/Snackbar';
import { feedSnackbarSx } from '../utils/feedSnackbar.ts';

export type MessageSentSnackbarProps = {
  noticeKey: number;
  onClose: () => void;
};

export function MessageSentSnackbar({
  noticeKey,
  onClose,
}: MessageSentSnackbarProps) {
  return (
    <Snackbar
      key={noticeKey > 0 ? `message-sent-${noticeKey}` : 'message-sent'}
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
        Message sent
      </Alert>
    </Snackbar>
  );
}
