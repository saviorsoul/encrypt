import { useState } from 'react';
import Alert from '@mui/material/Alert';
import Box from '@mui/material/Box';
import Button from '@mui/material/Button';
import Dialog from '@mui/material/Dialog';
import DialogActions from '@mui/material/DialogActions';
import DialogContent from '@mui/material/DialogContent';
import DialogTitle from '@mui/material/DialogTitle';
import Tab from '@mui/material/Tab';
import Tabs from '@mui/material/Tabs';
import TextField from '@mui/material/TextField';
import Typography from '@mui/material/Typography';
import { parseInvitationTokenFromText } from '@encrypt/core/invite/invitationLink';
import { primeInvitationQrCameraAccess } from '../lib/invitationQrScannerSupport.ts';

type AcceptInvitationTab = 'id' | 'qr';

export type AcceptInvitationDialogProps = {
  open: boolean;
  onClose: () => void;
  onSubmit: (token: string) => void;
  /** When false, the QR tab explains that scanning is not available. */
  qrScanAvailable?: boolean;
  onQrScanRequest?: () => void;
};

export function AcceptInvitationDialog({
  open,
  onClose,
  onSubmit,
  qrScanAvailable = false,
  onQrScanRequest,
}: AcceptInvitationDialogProps) {
  const [tab, setTab] = useState<AcceptInvitationTab>('id');
  const [value, setValue] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [prevOpen, setPrevOpen] = useState(open);

  if (open !== prevOpen) {
    setPrevOpen(open);
    if (open) {
      setTab('id');
      setValue('');
      setError(null);
    }
  }

  const handleSubmit = () => {
    const token = parseInvitationTokenFromText(value);
    if (!token) {
      setError('Enter a valid invitation ID (UUID).');
      return;
    }
    onSubmit(token);
  };

  const handleQrScanRequest = () => {
    if (!qrScanAvailable || !onQrScanRequest) {
      return;
    }
    primeInvitationQrCameraAccess();
    onQrScanRequest();
  };

  return (
    <Dialog open={open} onClose={onClose} fullWidth maxWidth="sm">
      <DialogTitle>Accept invite</DialogTitle>
      <DialogContent>
        <Tabs
          value={tab}
          onChange={(_, next: AcceptInvitationTab) => setTab(next)}
          variant="fullWidth"
          sx={{ mb: 2 }}
        >
          <Tab label="Invitation ID" value="id" />
          <Tab label="QR code" value="qr" />
        </Tabs>

        {tab === 'id' ? (
          <>
            <Typography variant="body2" color="text.secondary" sx={{ mb: 2 }}>
              Enter the invitation ID your friend shared with you.
            </Typography>
            <TextField
              data-testid="invitation-id-input"
              label="Invitation ID"
              value={value}
              onChange={(event) => {
                setValue(event.target.value);
                setError(null);
              }}
              fullWidth
              error={error != null}
              helperText={error}
              slotProps={{
                input: {
                  sx: { fontFamily: 'monospace', fontSize: '0.875rem' },
                },
              }}
            />
          </>
        ) : qrScanAvailable ? (
          <Typography variant="body2" color="text.secondary">
            Scan an invitation QR code from your friend. The code contains the
            invitation ID.
          </Typography>
        ) : (
          <Alert severity="info">
            QR code scanning is not available in this app yet. Ask your friend
            for the invitation ID instead.
          </Alert>
        )}
      </DialogContent>
      <DialogActions sx={{ justifyContent: 'space-between' }}>
        <Button onClick={onClose}>Cancel</Button>
        <Box>
          {tab === 'id' ? (
            <Button
              data-testid="invitation-id-open"
              variant="contained"
              onClick={handleSubmit}
              disabled={!value.trim()}
            >
              Open invitation
            </Button>
          ) : (
            <Button
              data-testid="invitation-qr-scan"
              variant="contained"
              onClick={handleQrScanRequest}
              disabled={!qrScanAvailable}
            >
              Scan QR code
            </Button>
          )}
        </Box>
      </DialogActions>
    </Dialog>
  );
}
