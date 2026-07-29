let activePrivateKeyId: string | null = null;

export function setActivePrivateKeyId(keyId: string | null): void {
  activePrivateKeyId = keyId;
}

export function getActivePrivateKeyId(): string | null {
  return activePrivateKeyId;
}
