import DialogActions from '@mui/material/DialogActions';
import DialogContent from '@mui/material/DialogContent';
import DialogTitle from '@mui/material/DialogTitle';
import Box from '@mui/material/Box';
import Button from '@mui/material/Button';
import Typography from '@mui/material/Typography';
import { AppDialog } from '@/components/shared/AppDialog.tsx';
import type { FeedLabBridgeDeepLinkAction } from '@encrypt/core/feed/feedLabBridge';
import { decodeFeedBridgePayload } from '@encrypt/core/feed/feedLabBridge';

type FeedLabBridgeConfirmDialogProps = {
  action: FeedLabBridgeDeepLinkAction | null;
  onCancel: () => void;
  onConfirm: () => void;
};

function formatPayloadPreview(
  action: FeedLabBridgeDeepLinkAction,
): string | null {
  if (action.type === 'feed-pair') {
    return null;
  }

  try {
    const decoded = decodeFeedBridgePayload<Record<string, unknown>>(
      action.payload,
    );
    return JSON.stringify(decoded, null, 2);
  } catch {
    return 'Unable to preview request payload.';
  }
}

function describeAction(action: FeedLabBridgeDeepLinkAction): {
  title: string;
  description: string;
  preview: string | null;
} {
  if (action.type === 'feed-pair') {
    return {
      title: 'Connect Feed Lab',
      description: `Feed Lab at ${action.origin} wants to use this Encrypt app for signing.`,
      preview: null,
    };
  }

  const opLabel =
    action.op === 'ecdh-agree'
      ? 'Derive shared secret'
      : action.op === 'ecdsa-sign'
        ? 'Sign request'
        : action.op === 'op-quick'
          ? 'Quick sign'
          : action.op;

  return {
    title: `Feed Lab: ${opLabel}`,
    description:
      'Feed Lab requested a cryptographic operation. Review the payload before continuing.',
    preview: formatPayloadPreview(action),
  };
}

export function FeedLabBridgeConfirmDialog({
  action,
  onCancel,
  onConfirm,
}: FeedLabBridgeConfirmDialogProps) {
  if (!action) {
    return null;
  }

  const { title, description, preview } = describeAction(action);

  return (
    <AppDialog open onClose={onCancel} fullWidth maxWidth="md">
      <DialogTitle>Feed Lab request</DialogTitle>
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
          <Box
            component="pre"
            sx={{
              p: 1.5,
              borderRadius: 1,
              bgcolor: 'action.hover',
              whiteSpace: 'pre-wrap',
              wordBreak: 'break-word',
              fontFamily: 'monospace',
              fontSize: '0.75rem',
              m: 0,
              maxHeight: 320,
              overflow: 'auto',
            }}
          >
            {preview}
          </Box>
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
