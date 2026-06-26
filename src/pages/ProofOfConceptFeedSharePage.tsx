import React from 'react';
import Box from '@mui/material/Box';
import Stack from '@mui/material/Stack';
import Typography from '@mui/material/Typography';
import { ShareFeedMessageStepByStep } from '@/components/encrypt/ShareFeedMessageStepByStep.tsx';
import { useDemoParentFeedMessage } from '@/hooks/useDemoParentFeedMessage.ts';
import { MockExternalRecipientProvider } from '@/components/providers/MockExternalRecipientProvider.tsx';

function ProofOfConceptFeedShareContent() {
  const { demo, loading, error } = useDemoParentFeedMessage();

  return (
    <Stack spacing={3} sx={{ mx: 'auto', maxWidth: 1320, px: 2, py: 2 }}>
      <Typography variant="body2" color="text.secondary">
        The demo feed post below is generated for your public key as recipient.
        You share it with new recipients by re-wrapping the message DEK under a
        fresh ephemeral key pair, using your private key where required.
      </Typography>
      <ShareFeedMessageStepByStep
        demo={demo}
        demoLoading={loading}
        demoError={error}
      />
    </Stack>
  );
}

export function ProofOfConceptFeedSharePage() {
  return (
    <MockExternalRecipientProvider>
      <Box>
        <ProofOfConceptFeedShareContent />
      </Box>
    </MockExternalRecipientProvider>
  );
}
