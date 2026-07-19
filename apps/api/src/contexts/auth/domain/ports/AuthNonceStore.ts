export type AuthNonceEntry = {
  nonce: string;
  expiresAtMs: number;
};

export interface AuthNonceStore {
  mint(keyId: string): Promise<AuthNonceEntry>;
  get(keyId: string): Promise<AuthNonceEntry | null>;
  getOrMint(keyId: string): Promise<AuthNonceEntry>;
  consume(keyId: string, nonce: string): Promise<boolean>;
}
