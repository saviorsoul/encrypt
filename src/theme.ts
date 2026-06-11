import { alpha, createTheme } from '@mui/material/styles';
import type { AlertProps } from '@mui/material/Alert';

const standardAlertSeverities = [
  'success',
  'info',
  'warning',
  'error',
] as const satisfies readonly AlertProps['severity'][];

export const darkTheme = createTheme({
  palette: {
    mode: 'dark',
  },
  components: {
    MuiAlert: {
      styleOverrides: {
        root: ({ theme, ownerState }) => {
          const severity = ownerState.severity ?? 'success';
          if (
            ownerState.variant !== 'standard' ||
            !standardAlertSeverities.includes(severity)
          ) {
            return {};
          }

          const paletteColor = theme.palette[severity];
          return {
            backgroundColor: alpha(paletteColor.main, 0.16),
            border: `1px solid ${alpha(paletteColor.main, 0.4)}`,
          };
        },
      },
    },
  },
  typography: {
    fontFamily: [
      '-apple-system',
      'BlinkMacSystemFont',
      '"Segoe UI"',
      'Roboto',
      '"Helvetica Neue"',
      'Arial',
      'sans-serif',
      '"Apple Color Emoji"',
      '"Segoe UI Emoji"',
      '"Segoe UI Symbol"',
    ].join(','),
  },
});
