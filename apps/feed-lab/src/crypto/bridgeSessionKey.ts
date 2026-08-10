type BridgeSessionState = {
  sessionKeyId: string;
  publicJwk: JsonWebKey;
  privateKey: CryptoKey;
};

const BRIDGE_SESSION_EXPIRED_ERROR =
  'Encrypt app bridge session expired. Connect the Encrypt app again.';

let bridgeSession: BridgeSessionState | null = null;

export function getBridgeSessionKeyId(): string | null {
  return bridgeSession?.sessionKeyId ?? null;
}

export function getBridgeSessionPrivateKey(): CryptoKey | null {
  return bridgeSession?.privateKey ?? null;
}

export function getBridgeSessionPublicJwk(): JsonWebKey | null {
  return bridgeSession?.publicJwk ?? null;
}

export async function createBridgeSessionKey(): Promise<BridgeSessionState> {
  if (bridgeSession) {
    return bridgeSession;
  }

  const { generateFeedBridgeSessionKeyPair } =
    await import('@encrypt/core/feed/feedLabBridgeSessionCrypto');
  const generated = await generateFeedBridgeSessionKeyPair();
  bridgeSession = {
    sessionKeyId: generated.sessionKeyId,
    publicJwk: generated.publicJwk,
    privateKey: generated.privateKey,
  };
  return bridgeSession;
}

export function requireBridgeSessionKey(
  expectedSessionKeyId: string,
): BridgeSessionState {
  if (!bridgeSession || bridgeSession.sessionKeyId !== expectedSessionKeyId) {
    throw new Error(BRIDGE_SESSION_EXPIRED_ERROR);
  }
  return bridgeSession;
}

export function clearBridgeSessionKey(): void {
  bridgeSession = null;
}
