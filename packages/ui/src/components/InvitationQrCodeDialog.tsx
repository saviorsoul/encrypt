import CloseIcon from '@mui/icons-material/Close';
import Box from '@mui/material/Box';
import Button from '@mui/material/Button';
import Dialog from '@mui/material/Dialog';
import DialogActions from '@mui/material/DialogActions';
import DialogContent from '@mui/material/DialogContent';
import DialogTitle from '@mui/material/DialogTitle';
import IconButton from '@mui/material/IconButton';
import Typography from '@mui/material/Typography';
import { QRCodeSVG } from 'qrcode.react';

export type InvitationQrCodeDialogProps = {
  open: boolean;
  /** Invitation UUID encoded in the QR (not a URL). */
  token: string;
  onClose: () => void;
};

export function InvitationQrCodeDialog({
  open,
  token,
  onClose,
}: InvitationQrCodeDialogProps) {
  return (
    <Dialog
      open={open}
      onClose={onClose}
      fullWidth
      maxWidth="xs"
      slotProps={{
        backdrop: {
          sx: {
            backgroundColor: '#000',
          },
        },
      }}
    >
      <DialogTitle sx={{ pr: 6 }}>
        Invitation QR code
        <IconButton
          aria-label="Close"
          onClick={onClose}
          sx={{ position: 'absolute', right: 8, top: 8 }}
        >
          <CloseIcon />
        </IconButton>
      </DialogTitle>
      <DialogContent>
        <Box sx={{ display: 'flex', justifyContent: 'center', py: 2 }}>
          <QRCodeSVG value={token} size={256} marginSize={2} />
        </Box>
        <Typography
          variant="body2"
          color="text.secondary"
          align="center"
          sx={{ mb: 2 }}
        >
          Show this QR code to your friend to accept the invitation. Let your
          friend click on the "Accept invite" button and use "QR code" scan.
        </Typography>
        <Typography
          variant="caption"
          color="text.secondary"
          align="center"
          sx={{
            display: 'block',
            fontFamily: 'monospace',
            overflowWrap: 'anywhere',
          }}
        >
          {token}
        </Typography>
      </DialogContent>
      <DialogActions>
        <Button onClick={onClose}>Close</Button>
      </DialogActions>
    </Dialog>
  );
}
