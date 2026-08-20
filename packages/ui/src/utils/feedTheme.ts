import {
  alpha,
  createTheme,
  type Theme,
  type ThemeOptions,
} from '@mui/material/styles';

export const brandColor = '#02baa5';

export const brandFontFamily = [
  '"Geist"',
  'ui-sans-serif',
  'system-ui',
  'sans-serif',
].join(', ');

declare module '@mui/material/styles' {
  interface Theme {
    feedLab: {
      brand: string;
      brandFontFamily: string;
      encBg: string;
      accentBg: string;
      cardShadow: string;
      shadowColor: string;
      insetShadow: string;
    };
  }
  interface ThemeOptions {
    feedLab?: {
      brand?: string;
      brandFontFamily?: string;
      encBg?: string;
      accentBg?: string;
      cardShadow?: string;
      shadowColor?: string;
      insetShadow?: string;
    };
  }
}

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
  insetShadow: alpha('#000000', 0.1),
};

const stoneDark = {
  bg: '#1c1917',
  card: '#292524',
  accent: '#d6d3d1',
  accentBg: '#44403c',
  text: '#fafaf9',
  sub: '#a8a29e',
  border: '#44403c',
  encBg: '#1c1917',
  cardShadow: '0 1px 2px rgba(0,0,0,0.2), 0 3px 12px rgba(0,0,0,0.15)',
  insetShadow: '#000000',
};

type StonePalette = typeof stoneLight;

function feedAppBackgroundImage(mode: 'light' | 'dark', stone: StonePalette) {
  const isLight = mode === 'light';

  // vw/vh tie gradients to the viewport; background-attachment: fixed keeps them still while scrolling.
  return isLight
    ? [
        `radial-gradient(ellipse 88vw 76vh at 50vw 52vh, ${alpha('#e7e5e4', 0.38)}, transparent 66%)`,
        `radial-gradient(ellipse 78vw 62vh at 100vw 100vh, ${alpha('#a8a29e', 0.22)}, transparent 58%)`,
        `linear-gradient(168deg, ${alpha(stone.bg, 0)} 42%, ${alpha('#f5f3ef', 0.5)} 68%, ${alpha('#d6d3d1', 0.34)} 100%)`,
      ].join(', ')
    : `radial-gradient(ellipse 75vw 60vh at 100vw 100vh, ${alpha('#a8a29e', 0.14)}, transparent 58%)`;
}

function feedAppBackgroundStyles(mode: 'light' | 'dark', stone: StonePalette) {
  return {
    backgroundColor: stone.bg,
    backgroundImage: feedAppBackgroundImage(mode, stone),
    backgroundAttachment: 'fixed',
    backgroundRepeat: 'no-repeat',
  };
}

const feedAppBarBackgroundStyles = (
  mode: 'light' | 'dark',
  stone: StonePalette,
) => ({
  ...feedAppBackgroundStyles(mode, stone),
  color: stone.text,
  border: 'none',
  boxShadow: 'none',
});

/** Full-page background for login and other standalone screens. */
export function feedAppBackgroundSx(theme: Theme) {
  const stone = theme.palette.mode === 'light' ? stoneLight : stoneDark;

  return {
    minHeight: '100vh',
    ...feedAppBackgroundStyles(theme.palette.mode, stone),
  };
}

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
      success: {
        main: '#02ba49',
      },
      divider: stone.border,
    },
    feedLab: {
      brand: brandColor,
      brandFontFamily: brandFontFamily,
      encBg: stone.encBg,
      accentBg: stone.accentBg,
      cardShadow: stone.cardShadow,
      insetShadow: stone.insetShadow,
    },
    typography: {
      fontFamily: feedLabFontFamily,
    },
    shape: {
      borderRadius: 8,
    },
    components: {
      MuiCssBaseline: {
        styleOverrides: {
          html: {
            scrollbarGutter: 'stable',
          },
          body: {
            fontFamily: feedLabFontFamily,
            minHeight: '100vh',
            ...feedAppBackgroundStyles(mode, stone),
          },
        },
      },
      MuiModal: {
        defaultProps: {
          // scrollbar-gutter: stable already reserves scrollbar space; MUI's
          // padding-right compensation would shift the feed left under dialogs.
          disableScrollLock: true,
        },
      },
      MuiPopover: {
        defaultProps: {
          disableScrollLock: true,
        },
      },
      MuiMenu: {
        defaultProps: {
          disableScrollLock: true,
        },
      },
      MuiAppBar: {
        defaultProps: {
          color: 'transparent',
        },
        styleOverrides: {
          root: feedAppBarBackgroundStyles(mode, stone),
          colorTransparent: feedAppBarBackgroundStyles(mode, stone),
        },
      },
      MuiPaper: {
        defaultProps: {
          elevation: 0,
        },
        styleOverrides: {
          root: ({ ownerState }) => {
            const elevation = ownerState.elevation ?? 0;

            return {
              border: `1px solid ${stone.border}`,
              ...(elevation === 0 ? { boxShadow: stone.cardShadow } : {}),
              '&:not(.MuiAppBar-root)': {
                backgroundImage: 'none',
              },
            };
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
      MuiDialog: {
        styleOverrides: {
          scrollPaper: ({ theme }) => ({
            alignItems: 'center',
            justifyContent: 'center',
            padding: theme.spacing(2),
          }),
          paper: {
            margin: 0,
            maxHeight: '100%',
            width: '100%',
          },
          paperWidthSm: {
            maxWidth: 550,
          },
          paperFullWidth: {
            width: '100%',
          },
        },
      },
      MuiDialogTitle: {
        styleOverrides: {
          root: ({ theme }) => ({
            padding: theme.spacing(1.5, 2),
          }),
        },
      },
      MuiDialogContent: {
        styleOverrides: {
          root: ({ theme }) => ({
            padding: theme.spacing(2),
          }),
        },
      },
      MuiDialogActions: {
        styleOverrides: {
          root: ({ theme }) => ({
            padding: theme.spacing(2),
          }),
        },
      },
      MuiAlert: {
        styleOverrides: {
          outlined: ({ theme }) => ({
            backgroundColor: theme.palette.background.paper,
            border: 'none',
            boxShadow: theme.shadows[2],
          }),
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
