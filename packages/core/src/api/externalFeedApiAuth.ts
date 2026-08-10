import type {
  AuthPublicKeyCoords,
  AuthRequestDescriptor,
} from '../crypto/authProof.ts';
import {
  authSignableIncludesBodyHash,
  buildAuthSignable,
  computeAuthTimeSlot,
} from '../crypto/authProof.ts';
import { buildFeedLabBridgeQuickOpApiAuthGetPayload } from '../feed/feedLabBridgeQuickOp.ts';
import {
  captureFeedApiNextNonce,
  commitNonceUse,
  confirmNonceUse,
  resolvePendingNonce,
  rollbackNonceUse,
  withKeyAuthLock,
  type FeedApiAuthProvider,
  type FeedApiAuthProviderConfig,
  type FeedApiAuthHeaderOptions,
} from './feedApiAuth.ts';
import type { FeedLabBridgeOracleOp } from '../feed/feedLabBridge.ts';
import type { UploadedPrivateKeyMaterial } from '../crypto/privateKeyMaterial.ts';

export type ExternalFeedApiAuthSigner = {
  getKeyId: () => string | null;
  getPublicKey: () => AuthPublicKeyCoords | null;
  requestBridgeOracle: <T>(
    op: FeedLabBridgeOracleOp,
    payload: unknown,
  ) => Promise<T>;
};

function stubMaterialForKeyId(keyId: string): UploadedPrivateKeyMaterial {
  return { keyId } as UploadedPrivateKeyMaterial;
}

export function createExternalFeedApiAuthProvider(
  signer: ExternalFeedApiAuthSigner,
  config: FeedApiAuthProviderConfig,
): FeedApiAuthProvider {
  return {
    captureNextNonceFromResponse: captureFeedApiNextNonce,
    async getAuthHeaders(request, options?: FeedApiAuthHeaderOptions) {
      const keyId = signer.getKeyId();
      if (!keyId) {
        throw new Error(
          'Encrypt app pairing is required. Connect the Encrypt app first.',
        );
      }

      const publicKey = signer.getPublicKey();
      if (!publicKey) {
        throw new Error('Encrypt app pairing is missing public key metadata.');
      }

      return withKeyAuthLock(keyId, async () => {
        const nonce = await resolvePendingNonce(
          config,
          stubMaterialForKeyId(keyId),
          options?.bypassClientNonceCache === true,
        );
        commitNonceUse(keyId);
        try {
          const timeSlot = computeAuthTimeSlot();
          const signable = await buildAuthSignable(
            keyId,
            { timeSlot, nonce },
            request,
          );
          const result = authSignableIncludesBodyHash(request.method)
            ? await signer.requestBridgeOracle<{ signature: string }>(
                'ecdsa-sign',
                { signable },
              )
            : await signer.requestBridgeOracle<{ signature: string }>(
                'op-quick',
                buildFeedLabBridgeQuickOpApiAuthGetPayload(signable),
              );
          confirmNonceUse(keyId);
          return {
            keyId,
            publicKey,
            timeSlot,
            nonce,
            signature: result.signature,
          };
        } catch (error) {
          rollbackNonceUse(keyId);
          throw error;
        }
      });
    },
  };
}

export type { AuthRequestDescriptor };
