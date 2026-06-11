import React, { useState } from 'react';
import Box from '@mui/material/Box';
import Stack from '@mui/material/Stack';
import { EncryptMessageStepByStep } from '@/components/encrypt/EncryptMessageStepByStep.tsx';
import { DecryptMessageStepByStep } from '@/components/decrypt/DecryptMessageStepByStep.tsx';
import { MockExternalRecipientProvider } from '@/components/providers/MockExternalRecipientProvider.tsx';
export function ProofOfConceptPage() {
  const [manifestPayload, setManifestPayload] = useState('');

  return (
    <MockExternalRecipientProvider>
      <Box>
        <Stack spacing={3} sx={{ mx: 'auto', maxWidth: 1320, px: 2, py: 2 }}>
          <EncryptMessageStepByStep onOutputChange={setManifestPayload} />
          <DecryptMessageStepByStep encryptedPayload={manifestPayload} />
        </Stack>
      </Box>
    </MockExternalRecipientProvider>
  );
}
