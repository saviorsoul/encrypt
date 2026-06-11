import React from 'react';
import Box from '@mui/material/Box';
import Stack from '@mui/material/Stack';
import Typography from '@mui/material/Typography';
import {
  COMMENT_CRYPTO_OVERVIEW,
  EncryptCommentStepByStep,
} from '@/components/encrypt/EncryptCommentStepByStep.tsx';

export function ProofOfConceptFeedCommentPage() {
  return (
    <Box>
      <Stack spacing={3} sx={{ mx: 'auto', maxWidth: 1320, px: 2, py: 2 }}>
        <Typography variant="body2" color="text.secondary">
          {COMMENT_CRYPTO_OVERVIEW}
        </Typography>
        <EncryptCommentStepByStep />
      </Stack>
    </Box>
  );
}
