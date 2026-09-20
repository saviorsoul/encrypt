import { useEffect } from 'react';
import { useSearchParams } from 'react-router-dom';
import Typography from '@mui/material/Typography';
import Box from '@mui/material/Box';
import { viewportMinHeightSx } from '@encrypt/ui/feedTheme';
import {
  handlePairCallback,
  parseBridgeCallbackRecord,
  writeBridgeResultToStorage,
} from '@lab/crypto/systemAppSigner.ts';
import { decodeFeedBridgePayload } from '@encrypt/core/feed/feedLabBridge';
import type { AuthPublicKeyCoords } from '@encrypt/core/crypto/authProof';

function parsePublicKeyFromParams(
  params: URLSearchParams,
): AuthPublicKeyCoords | null {
  const x = params.get('publicKeyX') ?? params.get('x');
  const y = params.get('publicKeyY') ?? params.get('y');
  if (typeof x === 'string' && x && typeof y === 'string' && y) {
    return { x, y };
  }
  return null;
}

function parseBridgeSessionFromParams(params: URLSearchParams): {
  bridgeSessionKeyId?: string;
  bridgeSessionPublicJwk?: JsonWebKey;
} {
  const bridgeSessionKeyId = params.get('bridgeSessionKeyId') ?? undefined;
  const encodedPublicJwk = params.get('bridgeSessionPublicJwk');
  if (!bridgeSessionKeyId && !encodedPublicJwk) {
    return {};
  }
  let bridgeSessionPublicJwk: JsonWebKey | undefined;
  if (encodedPublicJwk) {
    try {
      bridgeSessionPublicJwk =
        decodeFeedBridgePayload<JsonWebKey>(encodedPublicJwk);
    } catch {
      // ignore invalid bridge session public key
    }
  }
  return { bridgeSessionKeyId, bridgeSessionPublicJwk };
}

function closeBridgeCallbackTab(): void {
  if (import.meta.env.VITE_FEED_LAB_KEEP_CALLBACK_TAB) {
    return;
  }

  try {
    window.opener?.focus();
  } catch {
    // Ignore cross-origin opener access errors.
  }

  window.close();
}

export function BridgeCallbackPage() {
  const [searchParams] = useSearchParams();

  useEffect(() => {
    const requestId = searchParams.get('requestId');
    const error = searchParams.get('error') ?? undefined;
    const recordParam = searchParams.get('record') ?? undefined;

    if (requestId) {
      try {
        const record = recordParam
          ? parseBridgeCallbackRecord(recordParam)
          : {
              sessionKeyId: '',
              error: error ?? 'Invalid Encrypt app response.',
            };
        if (error && !record.error) {
          record.error = error;
        }
        writeBridgeResultToStorage(requestId, record);
      } catch {
        writeBridgeResultToStorage(requestId, {
          sessionKeyId: '',
          error: error ?? 'Invalid Encrypt app response.',
        });
      }
      closeBridgeCallbackTab();
      return;
    }

    const session = searchParams.get('session');
    if (session) {
      const keyId = searchParams.get('keyId') ?? '';
      const publicKey = parsePublicKeyFromParams(searchParams);
      const bridgeSession = parseBridgeSessionFromParams(searchParams);
      handlePairCallback({
        session,
        keyId,
        publicKey: publicKey ?? { x: '', y: '' },
        error,
        ...bridgeSession,
      });
      closeBridgeCallbackTab();
    }
  }, [searchParams]);

  return (
    <Box
      sx={{
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        ...viewportMinHeightSx,
      }}
    >
      <Typography variant="body2" color="text.secondary">
        {import.meta.env.VITE_FEED_LAB_KEEP_CALLBACK_TAB
          ? 'Callback recorded. This tab was kept open for testing.'
          : 'Returning to Feed Lab…'}
      </Typography>
    </Box>
  );
}

/** Pairing completion uses the same page with /bridge-callback/pair route. */
export function BridgePairCallbackPage() {
  return <BridgeCallbackPage />;
}
