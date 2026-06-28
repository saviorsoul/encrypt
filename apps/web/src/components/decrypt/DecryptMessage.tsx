import React from 'react';
import Box from '@mui/material/Box';
import Button from '@mui/material/Button';
import TextField from '@mui/material/TextField';
import Typography from '@mui/material/Typography';
import CircularProgress from '@mui/material/CircularProgress';
import LockOpenIcon from '@mui/icons-material/LockOpen';
import { useDecryptMessage } from '@/hooks/useDecryptMessage.ts';

type DecryptMessageProps = {
  encryptedPayload: string;
};

export function DecryptMessage({ encryptedPayload }: DecryptMessageProps) {
  const {
    keysLoading,
    decryptPayloadReady,
    decryptedText,
    decryptError,
    decryptBusy,
    decryptUserKeysReady,
    handleDecrypt,
  } = useDecryptMessage(encryptedPayload);

  if (keysLoading) {
    return (
      <Box sx={{ display: 'flex', alignItems: 'center', gap: 2, py: 2 }}>
        <CircularProgress size={24} />
        <Typography variant="body2" color="text.secondary">
          Loading keys…
        </Typography>
      </Box>
    );
  }

  return (
    <Box
      sx={{
        display: 'flex',
        flexDirection: 'column',
        gap: 2,
        maxWidth: 600,
        mt: 2,
      }}
    >
      <Box
        sx={{ display: 'flex', gap: 1, alignItems: 'center', flexWrap: 'wrap' }}
      >
        <Button
          variant="outlined"
          onClick={handleDecrypt}
          disabled={
            decryptBusy || !decryptUserKeysReady || !decryptPayloadReady
          }
          startIcon={<LockOpenIcon />}
        >
          Decrypt (upload private key)
        </Button>
        {decryptBusy && <CircularProgress size={22} />}
      </Box>

      {decryptError && (
        <Typography color="error" variant="body2">
          {decryptError}
        </Typography>
      )}

      {decryptedText !== '' && (
        <TextField
          label="Decrypted message"
          value={decryptedText}
          multiline
          minRows={3}
          fullWidth
          slotProps={{ input: { readOnly: true } }}
        />
      )}
    </Box>
  );
}
