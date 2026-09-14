import Alert from '@mui/material/Alert';
import { FeedSnackbar } from './FeedSnackbar.tsx';

export type MessageSentSnackbarProps = {
  noticeKey: number;
  onClose: () => void;
};

export function MessageSentSnackbar({
  noticeKey,
  onClose,
}: MessageSentSnackbarProps) {
  return (
    <FeedSnackbar
      key={noticeKey > 0 ? `message-sent-${noticeKey}` : 'message-sent'}
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
        Message sent
      </Alert>
    </FeedSnackbar>
  );
}
