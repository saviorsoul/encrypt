import { ExternalAddRecipientDialog } from '@/components/external-file/ExternalAddRecipientDialog.tsx';
import { ExternalInvalidFileDialog } from '@/components/external-file/ExternalInvalidFileDialog.tsx';
import { ExternalPrivateKeySignInDialog } from '@/components/external-file/ExternalPrivateKeySignInDialog.tsx';
import type { ClassifiedExternalJson } from '@/utils/classifyExternalJsonFile.ts';
import type { ExternalFileMetadata } from '@/vite-env.d.ts';

type ExternalFileActionDialogProps = {
  file: ExternalFileMetadata;
  classified: ClassifiedExternalJson;
  onClose: () => void;
  onPrivateKeyLoginComplete: () => void;
  onPublicKeySaved: () => void;
};

export function ExternalFileActionDialog({
  file,
  classified,
  onClose,
  onPrivateKeyLoginComplete,
  onPublicKeySaved,
}: ExternalFileActionDialogProps) {
  switch (classified.kind) {
    case 'invalid':
      return (
        <ExternalInvalidFileDialog
          fileName={file.name}
          error={classified.error}
          onClose={onClose}
        />
      );
    case 'message':
      return null;
    case 'privateKey':
      return (
        <ExternalPrivateKeySignInDialog
          fileName={file.name}
          jwk={classified.jwk}
          onClose={onClose}
          onComplete={onPrivateKeyLoginComplete}
        />
      );
    case 'publicKey':
      return (
        <ExternalAddRecipientDialog
          fileName={file.name}
          jwk={classified.jwk}
          onClose={onClose}
          onSaved={onPublicKeySaved}
        />
      );
  }
}
