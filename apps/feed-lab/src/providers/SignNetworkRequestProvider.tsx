import React, {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
  type ReactNode,
} from 'react';
import type { AuthRequestDescriptor } from '@encrypt/core/api/feedApiAuth';
import type { FeedApiAuthHeaderOptions } from '@encrypt/core/api/feedApi';
import { SignNetworkRequestDialog } from '@lab/components/SignNetworkRequestDialog.tsx';
import {
  formatSignRequestPreview,
  type SignRequestPreview,
} from '@lab/lib/formatSignRequest.ts';
import { getApiBaseUrl } from '@lab/lib/feedApiClient.ts';
import { useFeedLabSettings } from '@lab/providers/FeedLabSettingsProvider.tsx';

const SIGN_CANCELLED_ERROR = 'Network request signing was cancelled.';

type PendingApproval = {
  preview: SignRequestPreview;
  resolve: () => void;
  reject: (error: Error) => void;
};

type SignNetworkRequestContextValue = {
  requestSignApproval: (
    descriptor: AuthRequestDescriptor,
    _options?: FeedApiAuthHeaderOptions,
  ) => Promise<void>;
};

const SignNetworkRequestContext =
  createContext<SignNetworkRequestContextValue | null>(null);

function buildRequestKey(
  descriptor: AuthRequestDescriptor,
  baseUrl: string,
): string {
  const preview = formatSignRequestPreview(descriptor, baseUrl);
  return `${preview.method}\0${preview.url}\0${JSON.stringify(preview.payload)}`;
}

export function SignNetworkRequestProvider({
  children,
}: {
  children: ReactNode;
}) {
  const { requestsApprovalDialog } = useFeedLabSettings();
  const requestsApprovalDialogRef = useRef(requestsApprovalDialog);
  const currentRef = useRef<PendingApproval | null>(null);
  const queueRef = useRef<PendingApproval[]>([]);
  const inflightByKeyRef = useRef(new Map<string, Promise<void>>());
  const [dialogRequest, setDialogRequest] = useState<SignRequestPreview | null>(
    null,
  );

  useEffect(() => {
    requestsApprovalDialogRef.current = requestsApprovalDialog;
  }, [requestsApprovalDialog]);

  const syncDialog = useCallback(() => {
    setDialogRequest(currentRef.current?.preview ?? null);
  }, []);

  const enqueuePending = useCallback(
    (pending: PendingApproval) => {
      if (!currentRef.current) {
        currentRef.current = pending;
      } else {
        queueRef.current.push(pending);
      }
      syncDialog();
    },
    [syncDialog],
  );

  const dequeueNext = useCallback(() => {
    currentRef.current = queueRef.current.shift() ?? null;
    syncDialog();
  }, [syncDialog]);

  const requestSignApproval = useCallback(
    (descriptor: AuthRequestDescriptor): Promise<void> => {
      if (!requestsApprovalDialogRef.current) {
        return Promise.resolve();
      }

      const baseUrl = getApiBaseUrl();
      const requestKey = buildRequestKey(descriptor, baseUrl);
      const inflight = inflightByKeyRef.current.get(requestKey);
      if (inflight) {
        return inflight;
      }

      const promise = new Promise<void>((resolve, reject) => {
        const preview = formatSignRequestPreview(descriptor, baseUrl);
        const pending: PendingApproval = {
          preview,
          resolve: () => {
            inflightByKeyRef.current.delete(requestKey);
            resolve();
          },
          reject: (error: Error) => {
            inflightByKeyRef.current.delete(requestKey);
            reject(error);
          },
        };
        enqueuePending(pending);
      });

      inflightByKeyRef.current.set(requestKey, promise);
      return promise;
    },
    [enqueuePending],
  );

  const handleCancel = useCallback(() => {
    const current = currentRef.current;
    if (!current) {
      return;
    }
    current.reject(new Error(SIGN_CANCELLED_ERROR));
    dequeueNext();
  }, [dequeueNext]);

  const handleSign = useCallback(() => {
    const current = currentRef.current;
    if (!current) {
      return;
    }
    current.resolve();
    dequeueNext();
  }, [dequeueNext]);

  const value = useMemo(() => ({ requestSignApproval }), [requestSignApproval]);

  return (
    <SignNetworkRequestContext.Provider value={value}>
      {children}
      <SignNetworkRequestDialog
        key={
          dialogRequest
            ? `${dialogRequest.method}:${dialogRequest.url}:${JSON.stringify(dialogRequest.payload)}`
            : 'idle'
        }
        open={dialogRequest !== null}
        request={dialogRequest}
        onCancel={handleCancel}
        onSign={handleSign}
      />
    </SignNetworkRequestContext.Provider>
  );
}

export function useSignNetworkRequest(): SignNetworkRequestContextValue {
  const context = useContext(SignNetworkRequestContext);
  if (!context) {
    throw new Error(
      'useSignNetworkRequest must be used within SignNetworkRequestProvider',
    );
  }
  return context;
}
