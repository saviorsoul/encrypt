import { useCallback, useEffect, useRef, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { FeedLabBridgeConfirmDialog } from '@/components/providers/FeedLabBridgeConfirmDialog.tsx';
import { FeedLabBridgeKeyMismatchDialog } from '@/components/providers/FeedLabBridgeKeyMismatchDialog.tsx';
import { withUploadedPrivateKey } from '@/crypto/privateKeyFile.ts';
import { useAuth } from '@/hooks/useAuth.ts';
import { useKeysContext } from '@/hooks/useKeysContext.ts';
import {
  FeedLabBridgeKeyMismatchError,
  isFeedLabBridgeKeyMismatchError,
} from '@/utils/feedLabBridgeKeyMismatch.ts';
import {
  readPendingFeedLabBridgeAction,
  writePendingFeedLabBridgeAction,
  type PendingFeedLabBridgeRequest,
} from '@/utils/pendingFeedLabBridgeAction.ts';
import {
  buildFeedBridgeCallbackUrl,
  decodeFeedBridgePayload,
  type FeedLabBridgeDeepLinkAction,
  type FeedLabBridgeOracleOp,
} from '@encrypt/core/feed/feedLabBridge';
import { isAutoApprovableFeedLabBridgeQuickOp } from '@encrypt/core/feed/feedLabBridgeQuickOp';
import { isBackgroundFeedLabBridgeOp } from '@encrypt/core/feed/feedLabBridgeBackground';
import { executeFeedLabBridgeOracle } from '@encrypt/core/feed/feedLabBridgeOracles';
import { encryptFeedBridgeSessionPayload } from '@encrypt/core/feed/feedLabBridgeSessionCrypto';
import { importPublicKeyExtractable } from '@encrypt/core/crypto/ecdhKeys';
import {
  dispatchFeedLabBridgeAction,
  isFeedLabBridgeDeepLinkAction,
  setFeedLabBridgeListener,
} from '@/utils/feedLabBridgeDispatch.ts';
import { openExternalUrl } from '@/utils/openExternalUrl.ts';
import { isCapacitorApp } from '@/utils/isCapacitorApp.ts';
import {
  validateFeedLabBridgeCallbackPath,
  validateFeedLabBridgeOrigin,
  validateFeedLabPairCallback,
} from '@encrypt/core/feed/feedLabBridgeOpenExternal';
import {
  restoreAfterBackgroundQuickOp,
  ensureFeedBridgeVisibleForInteraction,
} from '@/utils/restoreAfterBackgroundQuickOp.ts';

type ApprovedFeedBridgeSession = {
  origin: string;
  callbackBase: string;
  keyId: string;
  browserPackage?: string | null;
};

type FeedOpAction = Extract<FeedLabBridgeDeepLinkAction, { type: 'feed-op' }>;

type KeyMismatchState = {
  expectedKeyId: string;
  actualKeyId: string;
};

const approvedSessions = new Map<string, ApprovedFeedBridgeSession>();

function canRunOpQuickSilently(
  action: FeedLabBridgeDeepLinkAction,
  isLoggedIn: boolean,
  keysReady: boolean,
): boolean {
  if (!isLoggedIn || !keysReady) {
    return false;
  }
  if (action.type !== 'feed-op') {
    return false;
  }
  return shouldAutoApproveFeedBridgeOp(action);
}

function shouldAutoApproveFeedBridgeOp(action: FeedOpAction): boolean {
  const session = approvedSessions.get(action.session);
  if (!session?.keyId) {
    return false;
  }
  if (action.op !== 'op-quick') {
    return false;
  }

  try {
    const payload = decodeFeedBridgePayload<unknown>(action.payload);
    return isAutoApprovableFeedLabBridgeQuickOp(payload);
  } catch {
    return false;
  }
}

function resolveFeedOpSession(
  action: FeedOpAction,
  browserPackage?: string | null,
): ApprovedFeedBridgeSession | null {
  const existing = approvedSessions.get(action.session);
  if (existing) {
    return existing;
  }

  if (!action.origin || !action.callback) {
    return null;
  }

  if (validateFeedLabBridgeCallbackPath(action.callback, 'op')) {
    return null;
  }
  if (validateFeedLabBridgeOrigin(action.origin)) {
    return null;
  }

  const rehydrated: ApprovedFeedBridgeSession = {
    origin: action.origin,
    callbackBase: action.callback,
    keyId: '',
    browserPackage: browserPackage ?? null,
  };
  approvedSessions.set(action.session, rehydrated);
  return rehydrated;
}

async function openOpErrorCallback(
  action: FeedOpAction,
  message: string,
  browserPackage?: string | null,
): Promise<void> {
  const session = resolveFeedOpSession(action, browserPackage);
  const callbackBase = session?.callbackBase ?? action.callback;
  if (!callbackBase || validateFeedLabBridgeCallbackPath(callbackBase, 'op')) {
    return;
  }

  await openValidatedExternalUrl(
    buildFeedBridgeCallbackUrl(callbackBase, {
      requestId: action.requestId,
      record: {
        sessionKeyId: action.bridgeSessionKeyId,
        error: message,
      },
    }),
    'op',
    session?.browserPackage ?? browserPackage,
  );
}

function deriveCallbackBaseFromPairCallback(callbackUrl: string): string {
  return callbackUrl.replace(/\/pair\/?$/, '').replace(/\/$/, '');
}

async function openValidatedExternalUrl(
  url: string,
  mode: 'pair' | 'op',
  browserPackage?: string | null,
): Promise<void> {
  await openExternalUrl(url, mode, {
    browserPackage,
    background: mode === 'op',
  });
}

async function readReferringBrowserPackage(): Promise<string | null> {
  if (!isCapacitorApp()) {
    return null;
  }
  try {
    const { Capacitor } = await import('@capacitor/core');
    if (Capacitor.getPlatform() !== 'android') {
      return null;
    }
    const { FeedLabExternalBrowser } =
      await import('@/capacitor/feedLabExternalBrowser.ts');
    const result = await FeedLabExternalBrowser.getReferringBrowserPackage();
    return result.packageName ?? null;
  } catch {
    return null;
  }
}

function validateFeedOpCallbackBase(callbackBase: string): string | null {
  return validateFeedLabBridgeCallbackPath(callbackBase, 'op');
}

function buildPairCompleteUrl(
  callback: string,
  options: {
    session: string;
    keyId: string;
    publicKey: { x: string; y: string };
    bridgeSessionKeyId?: string;
    bridgeSessionPublicJwk?: string;
    error?: string;
  },
): string {
  const params = new URLSearchParams();
  params.set('session', options.session);
  if (options.error) {
    params.set('error', options.error);
    if (options.bridgeSessionKeyId) {
      params.set('bridgeSessionKeyId', options.bridgeSessionKeyId);
    }
    if (options.bridgeSessionPublicJwk) {
      params.set('bridgeSessionPublicJwk', options.bridgeSessionPublicJwk);
    }
    return `${callback}?${params.toString()}`;
  }
  params.set('keyId', options.keyId);
  params.set('publicKeyX', options.publicKey.x);
  params.set('publicKeyY', options.publicKey.y);
  if (options.bridgeSessionKeyId) {
    params.set('bridgeSessionKeyId', options.bridgeSessionKeyId);
  }
  if (options.bridgeSessionPublicJwk) {
    params.set('bridgeSessionPublicJwk', options.bridgeSessionPublicJwk);
  }
  return `${callback}?${params.toString()}`;
}

function pairBridgeSessionParams(
  action: Extract<FeedLabBridgeDeepLinkAction, { type: 'feed-pair' }>,
): { bridgeSessionKeyId: string; bridgeSessionPublicJwk: string } {
  return {
    bridgeSessionKeyId: action.bridgeSessionKeyId,
    bridgeSessionPublicJwk: action.bridgeSessionPublicJwk,
  };
}

async function cancelBridgeAction(
  action: FeedLabBridgeDeepLinkAction,
  browserPackage: string | null,
  message: string,
): Promise<void> {
  if (action.type === 'feed-pair') {
    await openValidatedExternalUrl(
      buildPairCompleteUrl(action.callback, {
        session: action.session,
        keyId: '',
        publicKey: { x: '', y: '' },
        error: message,
        ...pairBridgeSessionParams(action),
      }),
      'pair',
      browserPackage,
    );
    return;
  }

  const session = resolveFeedOpSession(action, browserPackage);
  if (session) {
    await openValidatedExternalUrl(
      buildFeedBridgeCallbackUrl(session.callbackBase, {
        requestId: action.requestId,
        record: {
          sessionKeyId: action.bridgeSessionKeyId,
          error: message,
        },
      }),
      'op',
      session.browserPackage,
    );
    return;
  }

  if (action.callback) {
    await openOpErrorCallback(action, message, browserPackage);
  }
}

async function executeConfirmedBridgeAction(
  action: FeedLabBridgeDeepLinkAction,
  browserPackage: string | null,
): Promise<void> {
  if (action.type === 'feed-pair') {
    const pairValidationError = validateFeedLabPairCallback(
      action.callback,
      action.origin,
    );
    if (pairValidationError) {
      throw new Error(pairValidationError);
    }

    await withUploadedPrivateKey(async (material) => {
      const callbackBase = deriveCallbackBaseFromPairCallback(action.callback);
      const callbackBaseError = validateFeedOpCallbackBase(callbackBase);
      if (callbackBaseError) {
        throw new Error(callbackBaseError);
      }
      approvedSessions.set(action.session, {
        origin: action.origin,
        callbackBase,
        keyId: material.keyId,
        browserPackage,
      });
      await openValidatedExternalUrl(
        buildPairCompleteUrl(action.callback, {
          session: action.session,
          keyId: material.keyId,
          publicKey: material.publicKey,
          ...pairBridgeSessionParams(action),
        }),
        'pair',
        browserPackage,
      );
    });
    return;
  }

  let session = resolveFeedOpSession(action, browserPackage);
  if (!session) {
    await openOpErrorCallback(
      action,
      'Unknown Feed Lab session. Pair again from Feed Lab.',
      browserPackage,
    );
    throw new Error('Unknown Feed Lab session. Pair again from Feed Lab.');
  }

  const activeSession = session;
  const bridgeSessionPublicJwk = decodeFeedBridgePayload<JsonWebKey>(
    action.bridgeSessionPublicJwk,
  );
  const sessionPublicKey = await importPublicKeyExtractable(
    bridgeSessionPublicJwk,
  );
  const payload = decodeFeedBridgePayload<unknown>(action.payload);
  const oracleResult = await withUploadedPrivateKey(async (material) => {
    if (activeSession.keyId && material.keyId !== activeSession.keyId) {
      throw new FeedLabBridgeKeyMismatchError(
        activeSession.keyId,
        material.keyId,
      );
    }
    if (!activeSession.keyId) {
      approvedSessions.set(action.session, {
        ...activeSession,
        keyId: material.keyId,
      });
      session = approvedSessions.get(action.session) ?? activeSession;
    }
    return executeFeedLabBridgeOracle(
      material,
      action.op as FeedLabBridgeOracleOp,
      payload,
    );
  });

  const envelope = await encryptFeedBridgeSessionPayload(
    sessionPublicKey,
    oracleResult,
  );

  await openValidatedExternalUrl(
    buildFeedBridgeCallbackUrl(session.callbackBase, {
      requestId: action.requestId,
      record: {
        sessionKeyId: action.bridgeSessionKeyId,
        envelope,
      },
    }),
    'op',
    session.browserPackage,
  );
}

async function reportBridgeActionFailure(
  action: FeedLabBridgeDeepLinkAction,
  browserPackage: string | null,
  error: unknown,
): Promise<void> {
  const message =
    error instanceof Error ? error.message : 'Feed Lab request failed.';
  if (isFeedLabBridgeKeyMismatchError(error)) {
    throw error;
  }

  if (action.type === 'feed-pair') {
    const pairValidationError = validateFeedLabPairCallback(
      action.callback,
      action.origin,
    );
    if (pairValidationError) {
      throw new Error(pairValidationError);
    }
    await openValidatedExternalUrl(
      buildPairCompleteUrl(action.callback, {
        session: action.session,
        keyId: '',
        publicKey: { x: '', y: '' },
        error: message,
        ...pairBridgeSessionParams(action),
      }),
      'pair',
      browserPackage,
    );
    return;
  }

  await openOpErrorCallback(action, message, browserPackage);
}

async function parseCapacitorDeepLink(url: string): Promise<void> {
  const { parseDeepLink } = await import('../../../electron/deepLinks.js');
  const parsed = parseDeepLink(url);
  if (!parsed.ok || !isFeedLabBridgeDeepLinkAction(parsed.action)) {
    return;
  }
  dispatchFeedLabBridgeAction(parsed.action);
}

export function FeedLabBridgeHandler() {
  const navigate = useNavigate();
  const { user, logout } = useAuth();
  const keys = useKeysContext();
  const [pendingAction, setPendingAction] =
    useState<FeedLabBridgeDeepLinkAction | null>(null);
  const [keyMismatch, setKeyMismatch] = useState<KeyMismatchState | null>(null);
  const executingRef = useRef(false);
  const pendingBrowserPackageRef = useRef<string | null>(null);

  const keysReady = Boolean(user && keys.publicKeyJwk && !keys.loading);

  const dismissPending = useCallback(() => {
    setPendingAction(null);
  }, []);

  const runConfirmedRequest = useCallback(
    async (request: PendingFeedLabBridgeRequest) => {
      if (executingRef.current) {
        return;
      }

      executingRef.current = true;
      pendingBrowserPackageRef.current = request.browserPackage;
      const isBackgroundQuickOp = isBackgroundFeedLabBridgeOp(request.action);
      const wasMainWindowVisible = isBackgroundQuickOp
        ? await window.electron?.isMainWindowVisible?.()
        : null;

      try {
        await executeConfirmedBridgeAction(
          request.action,
          request.browserPackage,
        );
        writePendingFeedLabBridgeAction(null);
        setKeyMismatch(null);
        if (isBackgroundQuickOp) {
          await restoreAfterBackgroundQuickOp({ wasMainWindowVisible });
        }
      } catch (error) {
        if (isFeedLabBridgeKeyMismatchError(error)) {
          setKeyMismatch({
            expectedKeyId: error.expectedKeyId,
            actualKeyId: error.actualKeyId,
          });
          return;
        }

        writePendingFeedLabBridgeAction(null);
        setKeyMismatch(null);
        await reportBridgeActionFailure(
          request.action,
          request.browserPackage,
          error,
        );
      } finally {
        executingRef.current = false;
      }
    },
    [],
  );

  const beginBridgeRequest = useCallback(
    (
      action: FeedLabBridgeDeepLinkAction,
      browserPackage: string | null,
      options: { skipDialog: boolean },
    ) => {
      const request: PendingFeedLabBridgeRequest = {
        action,
        browserPackage,
        confirmed: true,
      };

      const ensureVisible = () => ensureFeedBridgeVisibleForInteraction();

      if (!user) {
        void ensureVisible().then(() => {
          writePendingFeedLabBridgeAction(request);
          navigate('/login', { replace: true });
        });
        return;
      }

      if (!keysReady) {
        void ensureVisible().then(() => {
          writePendingFeedLabBridgeAction(request);
        });
        return;
      }

      if (!options.skipDialog) {
        setPendingAction(action);
        return;
      }

      void runConfirmedRequest(request);
    },
    [keysReady, navigate, runConfirmedRequest, user],
  );

  const handleIncomingAction = useCallback(
    (action: FeedLabBridgeDeepLinkAction) => {
      void (async () => {
        const browserPackage = await readReferringBrowserPackage();
        pendingBrowserPackageRef.current = browserPackage;

        const isLoggedIn = Boolean(user);
        const runSilently = canRunOpQuickSilently(
          action,
          isLoggedIn,
          keysReady,
        );

        if (!runSilently) {
          await ensureFeedBridgeVisibleForInteraction();
        }

        beginBridgeRequest(action, browserPackage, { skipDialog: runSilently });
      })();
    },
    [beginBridgeRequest, keysReady, user],
  );

  useEffect(() => {
    setFeedLabBridgeListener(handleIncomingAction);

    void window.electron?.consumePendingDeepLinkAction?.().then((action) => {
      if (action && isFeedLabBridgeDeepLinkAction(action)) {
        handleIncomingAction(action);
      }
    });

    return () => {
      setFeedLabBridgeListener(null);
    };
  }, [handleIncomingAction]);

  useEffect(() => {
    if (!isCapacitorApp()) {
      return;
    }

    let cancelled = false;
    let removeListener: (() => void) | undefined;

    void (async () => {
      const { App } = await import('@capacitor/app');
      const launch = await App.getLaunchUrl();
      if (!cancelled && launch?.url) {
        await parseCapacitorDeepLink(launch.url);
      }
      const handle = await App.addListener('appUrlOpen', (event) => {
        void parseCapacitorDeepLink(event.url);
      });
      removeListener = () => {
        void handle.remove();
      };
    })();

    return () => {
      cancelled = true;
      removeListener?.();
    };
  }, []);

  useEffect(() => {
    if (user || pendingAction || keyMismatch) {
      return;
    }

    const pending = readPendingFeedLabBridgeAction();
    if (!pending?.confirmed) {
      return;
    }

    void ensureFeedBridgeVisibleForInteraction().then(() => {
      navigate('/login', { replace: true });
    });
  }, [keyMismatch, navigate, pendingAction, user]);

  useEffect(() => {
    if (!keysReady || pendingAction || keyMismatch) {
      return;
    }

    const pending = readPendingFeedLabBridgeAction();
    if (!pending?.confirmed) {
      return;
    }

    let cancelled = false;
    queueMicrotask(() => {
      if (!cancelled) {
        void runConfirmedRequest(pending);
      }
    });

    return () => {
      cancelled = true;
    };
  }, [keysReady, keyMismatch, pendingAction, runConfirmedRequest]);

  const handleCancel = useCallback(async () => {
    const action = pendingAction;
    dismissPending();
    if (!action) {
      return;
    }

    await cancelBridgeAction(
      action,
      pendingBrowserPackageRef.current,
      action.type === 'feed-pair'
        ? 'Feed Lab pairing was cancelled.'
        : 'Feed Lab request was cancelled.',
    );
  }, [dismissPending, pendingAction]);

  const handleConfirm = useCallback(async () => {
    const action = pendingAction;
    if (!action || executingRef.current) {
      return;
    }

    dismissPending();
    beginBridgeRequest(action, pendingBrowserPackageRef.current, {
      skipDialog: true,
    });
  }, [beginBridgeRequest, dismissPending, pendingAction]);

  const handleMismatchCancel = useCallback(async () => {
    const pending = readPendingFeedLabBridgeAction();
    setKeyMismatch(null);
    writePendingFeedLabBridgeAction(null);

    if (!pending) {
      return;
    }

    await cancelBridgeAction(
      pending.action,
      pending.browserPackage,
      pending.action.type === 'feed-pair'
        ? 'Feed Lab pairing was cancelled.'
        : 'Feed Lab request was cancelled.',
    );
  }, []);

  const handleMismatchChangeAccount = useCallback(() => {
    setKeyMismatch(null);
    logout();
    navigate('/login', { replace: true });
  }, [logout, navigate]);

  return (
    <>
      <FeedLabBridgeConfirmDialog
        action={pendingAction}
        onCancel={() => void handleCancel()}
        onConfirm={() => void handleConfirm()}
      />
      <FeedLabBridgeKeyMismatchDialog
        open={keyMismatch !== null}
        expectedKeyId={keyMismatch?.expectedKeyId ?? ''}
        actualKeyId={keyMismatch?.actualKeyId ?? ''}
        onCancelAction={() => void handleMismatchCancel()}
        onChangeAccount={handleMismatchChangeAccount}
      />
    </>
  );
}
