import React, {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
  type ReactNode,
} from 'react';
import CircularProgress from '@mui/material/CircularProgress';
import { AppDialog } from '@/components/shared/AppDialog.tsx';
import DialogContent from '@mui/material/DialogContent';
import Stack from '@mui/material/Stack';
import Typography from '@mui/material/Typography';
import { useNavigate } from 'react-router-dom';
import { ExternalFileActionDialog } from '@/components/external-file/ExternalFileActionDialog.tsx';
import { classifyExternalJsonText } from '@/utils/classifyExternalJsonFile.ts';
import type { ClassifiedExternalJson } from '@/utils/classifyExternalJsonFile.ts';
import type { ExternalFileMetadata } from '@/vite-env.d.ts';
import { errorMessage } from '@/utils/errorMessage.ts';

export type PendingExternalImport = {
  text: string;
  fileName: string;
};

type OpenExternalFile = {
  file: ExternalFileMetadata;
  classified: ClassifiedExternalJson;
};

type ExternalFileContextValue = {
  pendingImport: PendingExternalImport | null;
  consumePendingImport: () => PendingExternalImport | null;
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
  const navigate = useNavigate();
  const [pendingImport, setPendingImport] =
    useState<PendingExternalImport | null>(null);
  const [loadingFile, setLoadingFile] = useState(false);
  const [openExternalFile, setOpenExternalFile] =
    useState<OpenExternalFile | null>(null);

  const consumePendingImport = useCallback(() => {
    let consumed: PendingExternalImport | null = null;
    setPendingImport((current) => {
      consumed = current;
      return null;
    });
    return consumed;
  }, []);

  const dismissOpenFile = useCallback(async () => {
    if (!openExternalFile) {
      return;
    }

    await window.electron?.dismissExternalFile(openExternalFile.file.path);
    setOpenExternalFile(null);
  }, [openExternalFile]);

  const handleImportRequested = useCallback(
    (payload: PendingExternalImport) => {
      void dismissOpenFile();
      setPendingImport(payload);
      navigate('/feed');
    },
    [dismissOpenFile, navigate],
  );

  const handlePrivateKeyLoginComplete = useCallback(() => {
    void dismissOpenFile();
  }, [dismissOpenFile]);

  useEffect(() => {
    if (!import.meta.env.VITE_ELECTRON || !window.electron) {
      return;
    }

    return window.electron.onExternalFileOpened((metadata) => {
      setLoadingFile(true);

      void (async () => {
        try {
          const content = await window.electron!.readExternalFile(
            metadata.path,
          );
          const classified = classifyExternalJsonText(content.text);
          setOpenExternalFile({ file: metadata, classified });
        } catch (caught) {
          setOpenExternalFile({
            file: metadata,
            classified: {
              kind: 'invalid',
              error: errorMessage(caught, 'Failed to read file.'),
            },
          });
        } finally {
          setLoadingFile(false);
        }
      })();
    });
  }, []);

  const value = useMemo(
    () => ({
      pendingImport,
      consumePendingImport,
    }),
    [pendingImport, consumePendingImport],
  );

  return (
    <ExternalFileContext value={value}>
      {children}
      {loadingFile ? (
        <AppDialog open fullWidth maxWidth="xs">
          <DialogContent>
            <Stack
              direction="row"
              spacing={1.5}
              sx={{ py: 1, alignItems: 'center' }}
            >
              <CircularProgress size={20} />
              <Typography variant="body2" color="text.secondary">
                Reading file…
              </Typography>
            </Stack>
          </DialogContent>
        </AppDialog>
      ) : null}
      {openExternalFile ? (
        <ExternalFileActionDialog
          file={openExternalFile.file}
          classified={openExternalFile.classified}
          onClose={() => {
            void dismissOpenFile();
          }}
          onImportRequested={handleImportRequested}
          onPrivateKeyLoginComplete={handlePrivateKeyLoginComplete}
          onPublicKeySaved={() => {
            void dismissOpenFile();
          }}
        />
      ) : null}
    </ExternalFileContext>
  );
}
