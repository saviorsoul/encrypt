import DialogActions from '@mui/material/DialogActions';
import DialogContent from '@mui/material/DialogContent';
import DialogTitle from '@mui/material/DialogTitle';
import Button from '@mui/material/Button';
import Typography from '@mui/material/Typography';
import { AppDialog } from '@/components/shared/AppDialog.tsx';
import type { DeepLinkAction } from '@/vite-env.d.ts';

type ElectronDeepLinkConfirmDialogProps = {
  action: DeepLinkAction | null;
  onCancel: () => void;
  onConfirm: () => void;
};

function truncatePreview(text: string, maxLength = 200): string {
  if (text.length <= maxLength) {
    return text;
  }
  return `${text.slice(0, maxLength - 1)}…`;
}

function describeAction(action: DeepLinkAction): {
  title: string;
  description: string;
  preview: string | null;
} {
  switch (action.type) {
    case 'copy-public-key':
      return {
        title: 'Copy public key',
        description:
          'An external app asked to copy your Encrypt public key to the clipboard.',
        preview: null,
      };
    case 'encrypt':
      return {
        title: 'Encrypt message',
        description: 'An external app asked to encrypt a message.',
        preview: truncatePreview(action.text),
      };
    case 'decrypt':
      return {
        title: 'Decrypt message',
        description:
          'An external app asked to decrypt encrypted JSON in Encrypt.',
        preview: truncatePreview(action.text),
      };
  }
}

export function ElectronDeepLinkConfirmDialog({
  action,
  onCancel,
  onConfirm,
}: ElectronDeepLinkConfirmDialogProps) {
  if (!action) {
    return null;
  }

  const { title, description, preview } = describeAction(action);

  return (
    <AppDialog open onClose={onCancel} fullWidth maxWidth="xs">
      <DialogTitle>External request</DialogTitle>
      <DialogContent dividers>
        <Typography variant="subtitle2" sx={{ mb: 1 }}>
          {title}
        </Typography>
        <Typography
          variant="body2"
          color="text.secondary"
          sx={{ mb: preview ? 2 : 0 }}
        >
          {description}
        </Typography>
        {preview ? (
          <Typography
            variant="body2"
            sx={{
              p: 1.5,
              borderRadius: 1,
              bgcolor: 'action.hover',
              whiteSpace: 'pre-wrap',
              wordBreak: 'break-word',
              fontFamily: 'monospace',
              fontSize: '0.8rem',
            }}
          >
            {preview}
          </Typography>
        ) : null}
      </DialogContent>
      <DialogActions>
        <Button onClick={onCancel}>Cancel</Button>
        <Button variant="contained" onClick={onConfirm}>
          Continue
        </Button>
      </DialogActions>
    </AppDialog>
  );
}
