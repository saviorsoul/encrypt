import React from 'react';
import Box from '@mui/material/Box';
import Stack from '@mui/material/Stack';
import Typography from '@mui/material/Typography';
import { EncryptCommentStepByStep } from '@/components/encrypt/EncryptCommentStepByStep.tsx';
import { useDemoParentFeedMessage } from '@/hooks/useDemoParentFeedMessage.ts';

export function ProofOfConceptFeedCommentPage() {
  const { demo, loading, error } = useDemoParentFeedMessage();

  return (
    <Box>
      <Stack spacing={3} sx={{ mx: 'auto', maxWidth: 1320, px: 2, py: 2 }}>
        <Typography variant="body2" color="text.secondary">
          The demo feed post below is generated for your public key as
          recipient. You comment as that recipient using your private key where
          required.
        </Typography>
        <EncryptCommentStepByStep
          demo={demo}
          demoLoading={loading}
          demoError={error}
        />
      </Stack>
    </Box>
  );
}
