import { alpha, createTheme, type Theme } from '@mui/material/styles';
import type { AlertProps } from '@mui/material/Alert';

const standardAlertSeverities = [
  'success',
  'info',
  'warning',
  'error',
] as const satisfies readonly AlertProps['severity'][];

const sharedThemeOptions = {
  components: {
    MuiAlert: {
      styleOverrides: {
        root: ({
          theme,
          ownerState,
        }: {
          theme: Theme;
          ownerState: AlertProps;
        }) => {
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
} as const;

export const lightTheme = createTheme({
  palette: {
    mode: 'light',
  },
  ...sharedThemeOptions,
});

export const darkTheme = createTheme({
  palette: {
    mode: 'dark',
  },
  ...sharedThemeOptions,
});
