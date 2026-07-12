import React, { useCallback } from 'react';
import Box from '@mui/material/Box';
import DialogContent from '@mui/material/DialogContent';
import DialogTitle from '@mui/material/DialogTitle';
import IconButton from '@mui/material/IconButton';
import Typography from '@mui/material/Typography';
import CloseIcon from '@mui/icons-material/Close';
import { AppDialog } from '@/components/shared/AppDialog.tsx';
import { SendMessagePanel } from '@lab/components/SendMessagePanel.tsx';
import type { useFeedLabRecipients } from '@lab/hooks/useFeedLabRecipients.ts';
import type { usePrivateKeySession } from '@lab/hooks/usePrivateKeySession.ts';

type SendMessageDialogProps = {
  open: boolean;
  withPrivateKey: ReturnType<typeof usePrivateKeySession>['withPrivateKey'];
  keyId: string | null;
  recipients: ReturnType<typeof useFeedLabRecipients>;
  onClose: () => void;
  onSendSuccess: () => Promise<void>;
  onMessageSent: (detail: {
    messageId: string;
    copyPayload: string | null;
  }) => void;
};

export function SendMessageDialog({
  open,
  withPrivateKey,
  keyId,
  recipients,
  onClose,
  onSendSuccess,
  onMessageSent,
}: SendMessageDialogProps) {
  const handleSendSuccess = useCallback(async () => {
    await onSendSuccess();
    onClose();
  }, [onClose, onSendSuccess]);

  return (
    <AppDialog
      open={open}
      onClose={onClose}
      maxWidth="sm"
      fullWidth
      slotProps={{
        paper: {
          sx: {
            display: 'flex',
            flexDirection: 'column',
            maxHeight: 'min(90vh, 720px)',
            overflow: 'hidden',
          },
        },
      }}
    >
      <DialogTitle
        component="div"
        sx={{
          boxSizing: 'border-box',
          width: '100%',
          display: 'flex',
          alignItems: 'center',
          gap: 1,
          m: 0,
          px: 2.5,
          py: 1.5,
          flexShrink: 0,
        }}
      >
        <Typography
          variant="h6"
          component="span"
          sx={{ flex: 1, minWidth: 0, lineHeight: 1.3 }}
        >
          Create message
        </Typography>
        <IconButton
          aria-label="Close"
          onClick={onClose}
          size="small"
          sx={{ flexShrink: 0 }}
        >
          <CloseIcon fontSize="small" />
        </IconButton>
      </DialogTitle>
      <DialogContent
        sx={{
          px: 2.5,
          pt: 1,
          pb: 2.5,
          overflowX: 'hidden',
          overflowY: 'auto',
          minHeight: 0,
          flex: '1 1 auto',
        }}
      >
        <Box sx={{ minWidth: 0, width: '100%' }}>
          <SendMessagePanel
            variant="plain"
            withPrivateKey={withPrivateKey}
            keyId={keyId}
            recipients={recipients}
            onSendSuccess={handleSendSuccess}
            onMessageSent={onMessageSent}
            onClose={onClose}
          />
        </Box>
      </DialogContent>
    </AppDialog>
  );
}
