import { useEffect, useMemo, useState } from 'react';
import { importPublicKeyExtractable } from '@/crypto/ecdhKeys.ts';
import { ecPublicJwkThumbprintFromCryptoKey } from '@/crypto/jwkThumbprint.ts';
import {
  parsePublicKeyJwkText,
  type ParsePublicKeyJwkResult,
} from '@/utils/parsePublicKeyJwkText.ts';

export function usePublicKeyJwkInput(jwkText: string) {
  const [publicKey, setPublicKey] = useState<CryptoKey | null>(null);
  const [keyId, setKeyId] = useState<string | null>(null);
  const [importError, setImportError] = useState<string | null>(null);
  const [importing, setImporting] = useState(false);
  const [prevParsed, setPrevParsed] = useState<ParsePublicKeyJwkResult | null>(
    null,
  );

  const parsed = useMemo<ParsePublicKeyJwkResult>(
    () => parsePublicKeyJwkText(jwkText),
    [jwkText],
  );

  if (parsed !== prevParsed) {
    setPrevParsed(parsed);
    if (parsed.ok === false) {
      setPublicKey(null);
      setKeyId(null);
      setImportError(parsed.empty ? null : parsed.error);
      setImporting(false);
    } else {
      setImporting(true);
    }
  }

  useEffect(() => {
    if (parsed.ok === false) {
      return;
    }

    let cancelled = false;
    const jwk = parsed.jwk;

    async function importJwk() {
      try {
        const key = await importPublicKeyExtractable(jwk);
        const id = await ecPublicJwkThumbprintFromCryptoKey(key);
        if (!cancelled) {
          setPublicKey(key);
          setKeyId(id);
          setImportError(null);
        }
      } catch (e) {
        if (!cancelled) {
          setPublicKey(null);
          setKeyId(null);
          setImportError(
            e instanceof Error ? e.message : 'Could not import public key JWK.',
          );
        }
      } finally {
        if (!cancelled) {
          setImporting(false);
        }
      }
    }

    importJwk();

    return () => {
      cancelled = true;
    };
  }, [parsed]);

  const isValid = Boolean(publicKey && keyId && !importError && !importing);
  const jwkError =
    parsed.ok === true ? importError : parsed.empty ? null : parsed.error;

  return {
    publicKey,
    keyId,
    jwk: parsed.ok ? parsed.jwk : null,
    isValid,
    importing,
    jwkError,
  };
}
