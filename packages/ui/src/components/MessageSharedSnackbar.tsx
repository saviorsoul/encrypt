import Alert from '@mui/material/Alert';
import { FeedSnackbar } from './FeedSnackbar.tsx';

export type MessageSharedSnackbarProps = {
  noticeKey: number;
  onClose: () => void;
};

export function MessageSharedSnackbar({
  noticeKey,
  onClose,
}: MessageSharedSnackbarProps) {
  return (
    <FeedSnackbar
      key={noticeKey > 0 ? `message-shared-${noticeKey}` : 'message-shared'}
      open={noticeKey > 0}
      autoHideDuration={5000}
      onClose={onClose}
      anchorOrigin={{ vertical: 'top', horizontal: 'center' }}
    >
      <Alert
        severity="success"
        variant="outlined"
        onClose={onClose}
        sx={{ width: '100%' }}
      >
        Message shared
      </Alert>
    </FeedSnackbar>
  );
}
