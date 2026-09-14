import Portal from '@mui/material/Portal';
import Snackbar, { type SnackbarProps } from '@mui/material/Snackbar';
import { feedSnackbarSx } from '../utils/feedSnackbar.ts';

export function FeedSnackbar({ sx, ...props }: SnackbarProps) {
  return (
    <Portal>
      <Snackbar
        {...props}
        sx={[feedSnackbarSx, ...(Array.isArray(sx) ? sx : sx ? [sx] : [])]}
      />
    </Portal>
  );
}
