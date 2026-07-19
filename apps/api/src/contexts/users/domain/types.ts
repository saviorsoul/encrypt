export type EcPublicKey = { x: string; y: string };

export type RegisterUserInput = {
  keyId: string;
  publicKey: EcPublicKey | Record<string, unknown>;
};
