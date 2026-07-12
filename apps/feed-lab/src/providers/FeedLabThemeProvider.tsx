import React, { type ReactNode } from 'react';
import CssBaseline from '@mui/material/CssBaseline';
import { ThemeProvider } from '@mui/material/styles';
import { feedLabDarkTheme, feedLabLightTheme } from '@lab/theme.ts';
import { useFeedLabSettings } from '@lab/providers/FeedLabSettingsProvider.tsx';

export function FeedLabThemeProvider({ children }: { children: ReactNode }) {
  const { colorMode } = useFeedLabSettings();
  const theme = colorMode === 'dark' ? feedLabDarkTheme : feedLabLightTheme;

  return (
    <ThemeProvider theme={theme}>
      <CssBaseline />
      {children}
    </ThemeProvider>
  );
}
