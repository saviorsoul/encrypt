import type { SxProps, Theme } from '@mui/material/styles';

export const FEED_SNACKBAR_TOP_OFFSET_PX = 5;

export const feedSnackbarSx: SxProps<Theme> = (theme) => ({
  top: 16 - FEED_SNACKBAR_TOP_OFFSET_PX,
  [theme.breakpoints.up('sm')]: {
    top: 24 - FEED_SNACKBAR_TOP_OFFSET_PX,
  },
});
