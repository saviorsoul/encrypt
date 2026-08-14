export type AuthNonceEntry = {
  nonce: string;
  expiresAtMs: number;
};

export type ConsumeAndRotateOutcome =
  | { status: 'rotated'; entry: AuthNonceEntry }
  | { status: 'minted'; entry: AuthNonceEntry }
  | { status: 'mismatch'; entry: AuthNonceEntry };

export interface AuthNonceStore {
  mint(keyId: string): Promise<AuthNonceEntry>;
  get(keyId: string): Promise<AuthNonceEntry | null>;
  getOrMint(keyId: string): Promise<AuthNonceEntry>;
  consume(keyId: string, nonce: string): Promise<boolean>;
  consumeAndRotate(
    keyId: string,
    nonce: string,
  ): Promise<ConsumeAndRotateOutcome>;
}
