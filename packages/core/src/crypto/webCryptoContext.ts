const INSECURE_CONTEXT_MESSAGE =
  'Cryptography requires a secure context. Open Feed Lab over HTTPS (or http://localhost), not http://<LAN-IP>. For phone testing, set FEED_LAB_DEV_HTTPS=true in .env and use https://<your-pc-ip>:5174.';

export function assertBrowserSubtleCrypto(): void {
  if (typeof globalThis.crypto?.subtle?.generateKey === 'function') {
    return;
  }

  if (
    typeof globalThis !== 'undefined' &&
    'isSecureContext' in globalThis &&
    !(globalThis as typeof globalThis & { isSecureContext?: boolean })
      .isSecureContext
  ) {
    throw new Error(INSECURE_CONTEXT_MESSAGE);
  }

  throw new Error(
    'Web Crypto (crypto.subtle) is not available in this browser.',
  );
}
