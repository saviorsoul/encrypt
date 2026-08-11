import { type ReactNode } from 'react';
import CssBaseline from '@mui/material/CssBaseline';
import { ThemeProvider } from '@mui/material/styles';
import {
  feedLabDarkTheme,
  feedLabLightTheme,
} from '@encrypt/ui/feedTheme';
import { useFeedntSettings } from '@feednt/providers/FeedntSettingsProvider.tsx';

export function FeedntThemeProvider({ children }: { children: ReactNode }) {
  const { colorMode } = useFeedntSettings();
  const theme = colorMode === 'dark' ? feedLabDarkTheme : feedLabLightTheme;

  return (
    <ThemeProvider theme={theme}>
      <CssBaseline />
      {children}
    </ThemeProvider>
  );
}
