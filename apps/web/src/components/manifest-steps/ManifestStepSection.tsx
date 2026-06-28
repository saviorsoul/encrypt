import React, { useEffect } from 'react';
import Box from '@mui/material/Box';
import type { SxProps, Theme } from '@mui/material/styles';
import { registerManifestStep } from '@/components/manifest-steps/manifestStepRegistry.ts';
import {
  manifestStepId,
  manifestStepScrollMarginSx,
  stepContentSx,
  type ManifestCryptoFlow,
} from '@/components/manifest-steps/stepLayout.ts';

type ManifestStepSectionProps = {
  flow: ManifestCryptoFlow;
  step: number;
  children: React.ReactNode;
  sx?: SxProps<Theme>;
};

export function ManifestStepSection({
  flow,
  step,
  children,
  sx,
}: ManifestStepSectionProps) {
  const id = manifestStepId(flow, step);

  useEffect(() => registerManifestStep(id), [id]);

  return (
    <Box
      id={id}
      sx={{ ...stepContentSx, ...manifestStepScrollMarginSx, ...sx }}
    >
      {children}
    </Box>
  );
}
