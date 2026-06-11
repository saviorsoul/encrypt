import React from 'react';
import Box from '@mui/material/Box';
import Button from '@mui/material/Button';

export function OneToOneDecryptPanel({
  decryptBusy,
  onDecrypt,
}: {
  decryptBusy: boolean;
  onDecrypt: () => void;
}) {
  return (
    <Box
      sx={{
        display: 'flex',
        flexWrap: 'wrap',
        gap: 1,
        alignItems: 'center',
        justifyContent: 'center',
        px: { xs: 1, sm: 2 },
        py: 2,
      }}
    >
      <Button variant="outlined" disabled={decryptBusy} onClick={onDecrypt}>
        Receive message
      </Button>
    </Box>
  );
}
