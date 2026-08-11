import {
  createContext,
  useCallback,
  useContext,
  useMemo,
  useState,
  type ReactNode,
} from 'react';
import {
  loadFeedntSettings,
  saveFeedntSettings,
  type FeedntColorMode,
  type FeedntSettings,
} from '@feednt/services/feedntSettingsStorage.ts';

type FeedntSettingsContextValue = FeedntSettings & {
  setColorMode: (colorMode: FeedntColorMode) => void;
};

const FeedntSettingsContext = createContext<FeedntSettingsContextValue | null>(
  null,
);

export function FeedntSettingsProvider({ children }: { children: ReactNode }) {
  const [settings, setSettings] = useState<FeedntSettings>(() =>
    loadFeedntSettings(),
  );

  const setColorMode = useCallback((colorMode: FeedntColorMode) => {
    setSettings((current) => {
      const next = { ...current, colorMode };
      saveFeedntSettings(next);
      return next;
    });
  }, []);

  const value = useMemo(
    () => ({
      ...settings,
      setColorMode,
    }),
    [settings, setColorMode],
  );

  return (
    <FeedntSettingsContext.Provider value={value}>
      {children}
    </FeedntSettingsContext.Provider>
  );
}

export function useFeedntSettings(): FeedntSettingsContextValue {
  const context = useContext(FeedntSettingsContext);
  if (!context) {
    throw new Error(
      'useFeedntSettings must be used within FeedntSettingsProvider',
    );
  }
  return context;
}
