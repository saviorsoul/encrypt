import React, { createContext, useContext } from 'react';
import type { FeedApi } from '@encrypt/core/api/feedApi';

export type SendMessageDependencies = {
  useFeedApi: () => FeedApi;
  isSendCancellationError?: (error: unknown) => boolean;
};

const SendMessageDependenciesContext =
  createContext<SendMessageDependencies | null>(null);

export type SendMessageDependenciesProviderProps = {
  value: SendMessageDependencies;
  children: React.ReactNode;
};

export function SendMessageDependenciesProvider({
  value,
  children,
}: SendMessageDependenciesProviderProps) {
  return (
    <SendMessageDependenciesContext.Provider value={value}>
      {children}
    </SendMessageDependenciesContext.Provider>
  );
}

export function useSendMessageDependencies(): SendMessageDependencies {
  const value = useContext(SendMessageDependenciesContext);
  if (!value) {
    throw new Error(
      'useSendMessageDependencies requires SendMessageDependenciesProvider',
    );
  }
  return value;
}
