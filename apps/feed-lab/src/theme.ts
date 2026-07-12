import {
  alpha,
  createTheme,
  type Theme,
  type ThemeOptions,
} from '@mui/material/styles';
import type { AlertProps } from '@mui/material/Alert';

declare module '@mui/material/styles' {
  interface Theme {
    feedLab: {
      encBg: string;
      accentBg: string;
      cardShadow: string;
    };
  }
  interface ThemeOptions {
    feedLab?: {
      encBg?: string;
      accentBg?: string;
      cardShadow?: string;
    };
  }
}

const standardAlertSeverities = [
  'success',
  'info',
  'warning',
  'error',
] as const satisfies readonly AlertProps['severity'][];

const stoneLight = {
  bg: '#f7f6f4',
  card: '#fdfcfb',
  accent: '#44403c',
  accentBg: '#f5f3ef',
  text: '#1c1917',
  sub: '#a8a29e',
  border: '#e7e5e4',
  encBg: '#f0ede9',
  cardShadow: '0 1px 2px rgba(28,25,23,0.05), 0 3px 12px rgba(28,25,23,0.04)',
};

const stoneDark = {
  bg: '#1c1917',
  card: '#292524',
  accent: '#d6d3d1',
  accentBg: '#44403c',
  text: '#fafaf9',
  sub: '#a8a29e',
  border: '#44403c',
  encBg: '#292524',
  cardShadow: '0 1px 2px rgba(0,0,0,0.2), 0 3px 12px rgba(0,0,0,0.15)',
};

export const feedLabFontFamily = [
  '"Poppins"',
  '"Noto Sans"',
  'system-ui',
  '-apple-system',
  'BlinkMacSystemFont',
  '"Segoe UI"',
  'Roboto',
  '"Helvetica Neue"',
  'Arial',
  'sans-serif',
  '"Apple Color Emoji"',
  '"Segoe UI Emoji"',
  '"Segoe Color Emoji"',
].join(',');

function alertOverrides() {
  return {
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
  };
}

function createStoneTheme(mode: 'light' | 'dark') {
  const stone = mode === 'light' ? stoneLight : stoneDark;

  const options: ThemeOptions = {
    palette: {
      mode,
      background: {
        default: stone.bg,
        paper: stone.card,
      },
      primary: {
        main: stone.accent,
        contrastText: mode === 'light' ? '#faf8f5' : '#1c1917',
      },
      text: {
        primary: stone.text,
        secondary: stone.sub,
      },
      divider: stone.border,
    },
    feedLab: {
      encBg: stone.encBg,
      accentBg: stone.accentBg,
      cardShadow: stone.cardShadow,
    },
    typography: {
      fontFamily: feedLabFontFamily,
    },
    shape: {
      borderRadius: 8,
    },
    components: {
      ...alertOverrides(),
      MuiCssBaseline: {
        styleOverrides: {
          body: {
            fontFamily: feedLabFontFamily,
            backgroundColor: stone.bg,
          },
        },
      },
      MuiAppBar: {
        styleOverrides: {
          root: {
            backgroundColor: stone.card,
            color: stone.text,
            borderBottom: `1px solid ${stone.border}`,
            boxShadow: 'none',
          },
        },
      },
      MuiPaper: {
        defaultProps: {
          elevation: 0,
        },
        styleOverrides: {
          root: {
            backgroundImage: 'none',
            border: `1px solid ${stone.border}`,
            boxShadow: stone.cardShadow,
          },
        },
      },
      MuiButton: {
        styleOverrides: {
          root: {
            textTransform: 'none',
            fontWeight: 600,
            borderRadius: 6,
          },
        },
      },
      MuiChip: {
        styleOverrides: {
          root: {
            borderRadius: 6,
          },
        },
      },
      MuiTabs: {
        styleOverrides: {
          indicator: {
            backgroundColor: stone.accent,
          },
        },
      },
    },
  };

  return createTheme(options);
}

export const feedLabLightTheme = createStoneTheme('light');
export const feedLabDarkTheme = createStoneTheme('dark');
