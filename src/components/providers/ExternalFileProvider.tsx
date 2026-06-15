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
import Alert from '@mui/material/Alert';
import Snackbar from '@mui/material/Snackbar';
import { useLocation, useNavigate } from 'react-router-dom';
import { ExternalFileActionDialog } from '@/components/external-file/ExternalFileActionDialog.tsx';
import { useAuth } from '@/hooks/useAuth.ts';
import { classifyExternalJsonText } from '@/utils/classifyExternalJsonFile.ts';
import type { ClassifiedExternalJson } from '@/utils/classifyExternalJsonFile.ts';
import {
  getImportDestinationFromText,
  getImportDestinationRoute,
  isOnImportDestinationRoute,
  type ImportDestination,
} from '@/utils/importDestination.ts';
import type { ExternalFileMetadata } from '@/vite-env.d.ts';
import { errorMessage } from '@/utils/errorMessage.ts';

export const PENDING_LOGIN_IMPORT_SNACKBAR_MESSAGE =
  'Message will be imported once you login';

export type PendingExternalImport = {
  text: string;
  fileName: string;
  destination: ImportDestination;
};

type OpenExternalFile = {
  file: ExternalFileMetadata;
  classified: ClassifiedExternalJson;
};

type ImportHandler = (payload: PendingExternalImport) => void;

type ExternalFileContextValue = {
  pendingImport: PendingExternalImport | null;
  importRequestId: number;
  consumePendingImport: () => PendingExternalImport | null;
  registerImportHandler: (
    destination: ImportDestination,
    handler: ImportHandler,
  ) => () => void;
};

const ExternalFileContext = createContext<ExternalFileContextValue | null>(
  null,
);

export function useExternalFileContext(): ExternalFileContextValue {
  const context = useContext(ExternalFileContext);
  if (!context) {
    throw new Error(
      'useExternalFileContext must be used within ExternalFileProvider',
    );
  }
  return context;
}

export function ExternalFileProvider({ children }: { children: ReactNode }) {
  const { user } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();
  const [pendingImport, setPendingImport] = useState<PendingExternalImport | null>(
    null,
  );
  const pendingImportRef = useRef<PendingExternalImport | null>(null);
  const [importRequestId, setImportRequestId] = useState(0);
  const importHandlersRef = useRef(
    new Map<ImportDestination, ImportHandler>(),
  );
  const [openExternalFile, setOpenExternalFile] =
    useState<OpenExternalFile | null>(null);
  const [loginImportSnackbarOpen, setLoginImportSnackbarOpen] = useState(false);
  const [loginImportSnackbarKey, setLoginImportSnackbarKey] = useState(0);

  const registerImportHandler = useCallback(
    (destination: ImportDestination, handler: ImportHandler) => {
      importHandlersRef.current.set(destination, handler);
      return () => {
        if (importHandlersRef.current.get(destination) === handler) {
          importHandlersRef.current.delete(destination);
        }
      };
    },
    [],
  );

  const consumePendingImport = useCallback(() => {
    const consumed = pendingImportRef.current;
    pendingImportRef.current = null;
    setPendingImport(null);
    return consumed;
  }, []);

  const queuePendingImport = useCallback((payload: PendingExternalImport) => {
    pendingImportRef.current = payload;
    setPendingImport(payload);
    setImportRequestId((id) => id + 1);
  }, []);

  const dismissOpenFile = useCallback(async () => {
    if (!openExternalFile) {
      return;
    }

    await window.electron?.dismissExternalFile(openExternalFile.file.path);
    setOpenExternalFile(null);
  }, [openExternalFile]);

  const queueMessageImport = useCallback(
    async (metadata: ExternalFileMetadata, text: string) => {
      const destination = getImportDestinationFromText(text);
      if (!destination) {
        setOpenExternalFile({
          file: metadata,
          classified: {
            kind: 'invalid',
            error: 'Unrecognized encrypted message format.',
          },
        });
        return;
      }

      const payload: PendingExternalImport = {
        text,
        fileName: metadata.name,
        destination,
      };

      await window.electron?.dismissExternalFile(metadata.path);

      const handler = importHandlersRef.current.get(destination);
      if (
        user &&
        handler &&
        isOnImportDestinationRoute(location.pathname, destination)
      ) {
        handler(payload);
        return;
      }

      if (!user) {
        queuePendingImport(payload);
        setLoginImportSnackbarKey((key) => key + 1);
        setLoginImportSnackbarOpen(true);
        return;
      }

      queuePendingImport(payload);
      navigate(getImportDestinationRoute(destination), {
        replace: true,
        state: { externalImportRequestId: Date.now() },
      });
    },
    [location.pathname, navigate, queuePendingImport, user],
  );

  const handlePrivateKeyLoginComplete = useCallback(() => {
    void dismissOpenFile();
  }, [dismissOpenFile]);

  useEffect(() => {
    if (!import.meta.env.VITE_ELECTRON || !window.electron) {
      return;
    }

    return window.electron.onExternalFileOpened((metadata) => {
      void (async () => {
        try {
          const content = await window.electron!.readExternalFile(
            metadata.path,
          );
          const classified = classifyExternalJsonText(content.text);
          if (classified.kind === 'message') {
            await queueMessageImport(metadata, classified.text);
            return;
          }

          setOpenExternalFile({ file: metadata, classified });
        } catch (caught) {
          setOpenExternalFile({
            file: metadata,
            classified: {
              kind: 'invalid',
              error: errorMessage(caught, 'Failed to read file.'),
            },
          });
        }
      })();
    });
  }, [queueMessageImport]);

  const value = useMemo(
    () => ({
      pendingImport,
      importRequestId,
      consumePendingImport,
      registerImportHandler,
    }),
    [
      pendingImport,
      importRequestId,
      consumePendingImport,
      registerImportHandler,
    ],
  );

  return (
    <ExternalFileContext value={value}>
      {children}
      {openExternalFile ? (
        <ExternalFileActionDialog
          file={openExternalFile.file}
          classified={openExternalFile.classified}
          onClose={() => {
            void dismissOpenFile();
          }}
          onPrivateKeyLoginComplete={handlePrivateKeyLoginComplete}
          onPublicKeySaved={() => {
            void dismissOpenFile();
          }}
        />
      ) : null}
      <Snackbar
        key={`pending-login-import-${loginImportSnackbarKey}`}
        open={loginImportSnackbarOpen}
        autoHideDuration={5000}
        onClose={() => setLoginImportSnackbarOpen(false)}
        anchorOrigin={{ vertical: 'top', horizontal: 'center' }}
      >
        <Alert
          severity="info"
          variant="filled"
          onClose={() => setLoginImportSnackbarOpen(false)}
          sx={{ width: '100%' }}
        >
          {PENDING_LOGIN_IMPORT_SNACKBAR_MESSAGE}
        </Alert>
      </Snackbar>
    </ExternalFileContext>
  );
}
