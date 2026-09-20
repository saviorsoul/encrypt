import React from 'react';
import Alert from '@mui/material/Alert';
import type { ReactNode } from 'react';
import type { ManifestCryptoFlow } from '@/components/manifest-steps/stepLayout.ts';
import { StepNumberBadge } from '@/components/manifest-steps/StepNumberBadge.tsx';

type StepInfoAlertProps = {
  number: number;
  flow: ManifestCryptoFlow;
  children: ReactNode;
};

export function StepInfoAlert({ number, flow, children }: StepInfoAlertProps) {
  return (
    <Alert
      variant="outlined"
      sx={{ borderColor: 'grey.900', color: 'text.primary' }}
      icon={<StepNumberBadge number={number} flow={flow} />}
    >
      {children}
    </Alert>
  );
}
