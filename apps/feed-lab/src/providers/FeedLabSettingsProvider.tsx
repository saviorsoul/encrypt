import React, {
  createContext,
  useCallback,
  useContext,
  useMemo,
  useState,
  type ReactNode,
} from 'react';
import {
  loadFeedLabSettings,
  saveFeedLabSettings,
  type FeedLabColorMode,
  type FeedLabSettings,
} from '@lab/services/feedLabSettingsStorage.ts';

type FeedLabSettingsContextValue = FeedLabSettings & {
  setAutomateDecryption: (enabled: boolean) => void;
  setRequestsApprovalDialog: (enabled: boolean) => void;
  setColorMode: (colorMode: FeedLabColorMode) => void;
};

const FeedLabSettingsContext =
  createContext<FeedLabSettingsContextValue | null>(null);

export function FeedLabSettingsProvider({ children }: { children: ReactNode }) {
  const [settings, setSettings] = useState<FeedLabSettings>(() =>
    loadFeedLabSettings(),
  );

  const setAutomateDecryption = useCallback((enabled: boolean) => {
    setSettings((current) => {
      const next = { ...current, automateDecryption: enabled };
      saveFeedLabSettings(next);
      return next;
    });
  }, []);

  const setRequestsApprovalDialog = useCallback((enabled: boolean) => {
    setSettings((current) => {
      const next = { ...current, requestsApprovalDialog: enabled };
      saveFeedLabSettings(next);
      return next;
    });
  }, []);

  const setColorMode = useCallback((colorMode: FeedLabColorMode) => {
    setSettings((current) => {
      const next = { ...current, colorMode };
      saveFeedLabSettings(next);
      return next;
    });
  }, []);

  const value = useMemo(
    () => ({
      ...settings,
      setAutomateDecryption,
      setRequestsApprovalDialog,
      setColorMode,
    }),
    [settings, setAutomateDecryption, setRequestsApprovalDialog, setColorMode],
  );

  return (
    <FeedLabSettingsContext.Provider value={value}>
      {children}
    </FeedLabSettingsContext.Provider>
  );
}

export function useFeedLabSettings(): FeedLabSettingsContextValue {
  const context = useContext(FeedLabSettingsContext);
  if (!context) {
    throw new Error(
      'useFeedLabSettings must be used within FeedLabSettingsProvider',
    );
  }
  return context;
}
