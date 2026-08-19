import React, { useCallback, useEffect, useRef } from 'react';
import DialogActions from '@mui/material/DialogActions';
import DialogContent from '@mui/material/DialogContent';
import { AppDialog } from './AppDialog.tsx';
import {
  SendMessageDialogActions,
  SendMessagePanel,
  useSendMessageForm,
  type SendMessageRecipients,
} from './SendMessagePanel.tsx';
import type { SendMessageKeysSession } from '../hooks/useBackendSendMessage.ts';

export type SendMessageDialogProps<
  TKeys extends SendMessageKeysSession,
  TRecipients extends SendMessageRecipients,
> = {
  open: boolean;
  keys: TKeys;
  recipients: TRecipients;
  onClose: () => void;
  onSendSuccess: () => Promise<void>;
  onMessageSent: (detail: {
    messageId: string;
    copyPayload: string | null;
  }) => void;
};

export function SendMessageDialog<
  TKeys extends SendMessageKeysSession,
  TRecipients extends SendMessageRecipients,
>({
  open,
  keys,
  recipients,
  onClose,
  onSendSuccess,
  onMessageSent,
}: SendMessageDialogProps<TKeys, TRecipients>) {
  const handleSendSuccess = useCallback(async () => {
    onClose();
    await onSendSuccess();
  }, [onClose, onSendSuccess]);

  const form = useSendMessageForm({
    keys,
    recipients,
    onSendSuccess: handleSendSuccess,
    onMessageSent,
  });

  const openRef = useRef(open);
  useEffect(() => {
    openRef.current = open;
  }, [open]);

  const handleExited = useCallback(() => {
    if (!openRef.current) {
      form.clearForm();
    }
  }, [form.clearForm]);

  const handleClose = useCallback(() => {
    if (form.busy) {
      return;
    }
    onClose();
  }, [form.busy, onClose]);

  return (
    <AppDialog
      data-testid="send-message-dialog"
      open={open}
      onClose={handleClose}
      title="Create message"
      closeDisabled={form.busy}
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
        transition: {
          onExited: handleExited,
        },
      }}
    >
      <DialogContent
        sx={{
          overflowX: 'hidden',
          overflowY: 'auto',
          minHeight: 0,
          flex: '1 1 auto',
        }}
      >
        <SendMessagePanel
          variant="plain"
          form={form}
          recipients={recipients}
          showActions={false}
        />
      </DialogContent>
      <DialogActions>
        <SendMessageDialogActions form={form} onClose={handleClose} />
      </DialogActions>
    </AppDialog>
  );
}
