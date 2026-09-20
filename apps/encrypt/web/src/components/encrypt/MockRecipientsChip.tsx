import React, { useContext, useEffect, useState } from 'react';
import Box from '@mui/material/Box';
import Chip from '@mui/material/Chip';
import Tooltip from '@mui/material/Tooltip';
import Typography from '@mui/material/Typography';
import LockIcon from '@mui/icons-material/Lock';
import {
  MOCK_EXTERNAL_RECIPIENT_COUNT,
  MockExternalRecipientContext,
} from '@/components/providers/MockExternalRecipientProvider.tsx';

const monospaceTooltipFieldSx = {
  fontFamily: 'monospace',
  fontSize: '0.65rem',
  whiteSpace: 'pre-wrap',
  wordBreak: 'break-all',
  display: 'block',
  mt: 0.5,
  mb: 1,
} as const;

export function MockRecipientsChip() {
  const mockExternal = useContext(MockExternalRecipientContext);
  const [firstRecipientKeys, setFirstRecipientKeys] = useState<{
    keyId: string;
    privateJwk: string;
    publicJwk: string;
  } | null>(null);
  const [prevFirst, setPrevFirst] = useState<
    NonNullable<typeof mockExternal>['recipients'][number] | undefined
  >(undefined);

  const first = mockExternal?.recipients[0];

  if (first !== prevFirst) {
    setPrevFirst(first);
    if (!first) {
      setFirstRecipientKeys(null);
    }
  }

  useEffect(() => {
    if (!first) {
      return;
    }

    let cancelled = false;

    void (async () => {
      try {
        const [privateJwk, publicJwk] = await Promise.all([
          crypto.subtle.exportKey('jwk', first.privateKey),
          crypto.subtle.exportKey('jwk', first.publicKey),
        ]);
        if (!cancelled) {
          setFirstRecipientKeys({
            keyId: first.keyId,
            privateJwk: JSON.stringify(privateJwk, null, 2),
            publicJwk: JSON.stringify(publicJwk, null, 2),
          });
        }
      } catch {
        if (!cancelled) {
          setFirstRecipientKeys(null);
        }
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [first]);

  const additionalCount = MOCK_EXTERNAL_RECIPIENT_COUNT - 1;

  const tooltipTitle = mockExternal?.loading ? (
    'Loading mock recipients…'
  ) : firstRecipientKeys ? (
    <Box sx={{ p: 0.5 }}>
      <Typography variant="caption" sx={{ display: 'block', fontWeight: 600 }}>
        Recipient 001 (keyId {firstRecipientKeys.keyId})
      </Typography>
      <Typography
        variant="caption"
        sx={{ display: 'block', mt: 1, fontWeight: 600 }}
      >
        Private key (JWK)
      </Typography>
      <Box component="span" sx={monospaceTooltipFieldSx}>
        {firstRecipientKeys.privateJwk}
      </Box>
      <Typography variant="caption" sx={{ display: 'block', fontWeight: 600 }}>
        Public key (JWK)
      </Typography>
      <Box component="span" sx={monospaceTooltipFieldSx}>
        {firstRecipientKeys.publicJwk}
      </Box>
      <Typography variant="caption" sx={{ display: 'block', mt: 0.5 }}>
        {additionalCount > 0
          ? `${additionalCount} more mock recipients were generated the same way (${MOCK_EXTERNAL_RECIPIENT_COUNT} total). Encrypt uses each public key; mock decrypt buttons use the private key of first recipient.`
          : 'Encrypt uses the public key; mock decrypt uses the matching private key.'}
      </Typography>
    </Box>
  ) : (
    'Mock recipients unavailable.'
  );

  return (
    <Tooltip
      title={tooltipTitle}
      arrow
      placement="bottom"
      slotProps={{
        tooltip: {
          sx: { maxWidth: 500, maxHeight: 420, overflow: 'auto' },
        },
      }}
    >
      <span>
        <Chip
          icon={<LockIcon fontSize="small" />}
          label={`${MOCK_EXTERNAL_RECIPIENT_COUNT} × external mock recipients`}
          size="small"
          color="primary"
          variant="outlined"
          sx={{ cursor: 'help' }}
        />
      </span>
    </Tooltip>
  );
}
