import { useCallback, useContext, useEffect, useRef, useState } from 'react';
import { MockExternalRecipientContext } from '@/components/providers/MockExternalRecipientProvider.tsx';
import { logError } from '@/utils/logError.ts';
import {
  deriveAesGcmKekFromHkdfMaterial,
  deriveEcdhSharedSecretBits,
  importSharedSecretAsHkdfKeyMaterial,
} from '@/crypto/manifestEncrypt.ts';
import {
  aesGcmDecryptManifestBody,
  aesGcmDecryptEncryptedDek,
  getKeyManifestEntryForRecipient,
  getManifestSignableBody,
  importManifestDek,
  importSenderEphemeralPublicKey,
  parseEncryptedContentFromPayload,
  parseManifestPayload,
} from '@/crypto/manifestDecrypt.ts';
import { slimEcPrivateJwk } from '@/crypto/jwkThumbprint.ts';
import { verifyManifestSignature } from '@/crypto/manifestSign.ts';
import type { KeyManifestRecipientPayload } from '@/types/manifest.ts';
import { base64ToBytes, bytesToBase64 } from '@/utils/bytes.ts';
import { joinLinesWithPaddedIndices } from '@/utils/joinLinesWithPaddedIndices.ts';

export type DecryptVerifyExample = {
  senderPublicJwk: string;
  senderSignature: string;
  signatureValid: boolean;
};

export type DecryptEcdheSharedSecretExample = {
  recipientPrivateJwk: string;
  ephemeralPublicKey: string;
  sharedSecretBase64: string;
};

export type DecryptImportHkdfMaterialExample = {
  sharedSecretBase64: string;
  hkdfMaterialFingerprintBase64: string;
};

export type DecryptDeriveKekExample = {
  hkdfMaterialFingerprintBase64: string;
  hkdfSaltBase64: string;
  kekBase64: string;
};

export type DecryptDekExample = {
  kekBase64: string;
  encryptedDekIvBase64: string;
  encryptedDekBase64: string;
  dekBase64: string;
};

export type DecryptContentExample = {
  dekBase64: string;
  contentIvBase64: string;
  ciphertextBase64: string;
  plaintextMessage: string;
};

export function useDecryptManifestSteps(encryptedPayload: string) {
  const mockExternal = useContext(MockExternalRecipientContext);

  const recipientPrivateKeyRef = useRef<CryptoKey | null>(null);
  const recipientKeyIdRef = useRef<string | null>(null);
  const signableBodyJsonRef = useRef<string | null>(null);
  const keyManifestEntryRef = useRef<KeyManifestRecipientPayload | null>(null);
  const encryptedContentRef = useRef<ReturnType<
    typeof parseEncryptedContentFromPayload
  > | null>(null);
  const sharedSecretRef = useRef<ArrayBuffer | null>(null);
  const hkdfMaterialRef = useRef<CryptoKey | null>(null);
  const kekRef = useRef<CryptoKey | null>(null);
  const hkdfSaltRef = useRef<Uint8Array | null>(null);
  const rawDekRef = useRef<ArrayBuffer | null>(null);

  const [verifyExample, setVerifyExample] =
    useState<DecryptVerifyExample | null>(null);
  const [ephemeralPublicKeyOutput, setEphemeralPublicKeyOutput] = useState('');
  const [contentIvOutput, setContentIvOutput] = useState('');
  const [contentCiphertextOutput, setContentCiphertextOutput] = useState('');
  const [keyManifestEntryOutput, setKeyManifestEntryOutput] = useState('');
  const [ecdheSharedSecretExample, setEcdheSharedSecretExample] =
    useState<DecryptEcdheSharedSecretExample | null>(null);
  const [ecdheOutput, setEcdheOutput] = useState('');
  const [importHkdfMaterialExample, setImportHkdfMaterialExample] =
    useState<DecryptImportHkdfMaterialExample | null>(null);
  const [hkdfMaterialOutput, setHkdfMaterialOutput] = useState('');
  const [deriveKekExample, setDeriveKekExample] =
    useState<DecryptDeriveKekExample | null>(null);
  const [hkdfSaltOutput, setHkdfSaltOutput] = useState('');
  const [aesKekOutput, setAesKekOutput] = useState('');
  const [decryptDekExample, setDecryptDekExample] =
    useState<DecryptDekExample | null>(null);
  const [dekOutput, setDekOutput] = useState('');
  const [decryptContentExample, setDecryptContentExample] =
    useState<DecryptContentExample | null>(null);
  const [plaintextOutput, setPlaintextOutput] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [busyStep, setBusyStep] = useState<
    | 'verify'
    | 'extract'
    | 'ecdhe'
    | 'hkdfImport'
    | 'aesKek'
    | 'decryptDek'
    | 'decrypt'
    | null
  >(null);
  const [runAllBusy, setRunAllBusy] = useState(false);

  const mockPrivateKey = mockExternal?.recipients?.[0]?.privateKey ?? null;
  const mockRecipientKeyId = mockExternal?.recipients?.[0]?.keyId ?? null;

  const keysLoading = Boolean(mockExternal?.loading ?? true);
  const decryptMockKeysReady = Boolean(mockPrivateKey && mockRecipientKeyId);
  const payloadReady = Boolean(encryptedPayload.trim());

  const clearCryptoPath = useCallback(() => {
    recipientPrivateKeyRef.current = null;
    sharedSecretRef.current = null;
    hkdfMaterialRef.current = null;
    kekRef.current = null;
    hkdfSaltRef.current = null;
    rawDekRef.current = null;
    setEcdheOutput('');
    setEcdheSharedSecretExample(null);
    setHkdfMaterialOutput('');
    setImportHkdfMaterialExample(null);
    setHkdfSaltOutput('');
    setAesKekOutput('');
    setDeriveKekExample(null);
    setDekOutput('');
    setDecryptDekExample(null);
    setPlaintextOutput('');
    setDecryptContentExample(null);
  }, []);

  const resetSteps = useCallback(() => {
    signableBodyJsonRef.current = null;
    keyManifestEntryRef.current = null;
    encryptedContentRef.current = null;
    recipientKeyIdRef.current = null;
    clearCryptoPath();
    setVerifyExample(null);
    setEphemeralPublicKeyOutput('');
    setContentIvOutput('');
    setContentCiphertextOutput('');
    setKeyManifestEntryOutput('');
    setError(null);
  }, [clearCryptoPath]);

  useEffect(() => {
    // Resetting step UI when the payload changes is intentional.
    // eslint-disable-next-line react-hooks/set-state-in-effect -- sync reset on prop change
    resetSteps();
  }, [encryptedPayload, resetSteps]);

  const runVerifySignature = useCallback(async () => {
    setError(null);
    resetSteps();

    const trimmed = encryptedPayload.trim();
    if (!trimmed) {
      setError('No payload: generate encrypted text in the section above.');
      return;
    }

    setBusyStep('verify');
    try {
      const payload = parseManifestPayload(trimmed);
      await verifyManifestSignature(payload);
      const signableBody = getManifestSignableBody(payload);
      signableBodyJsonRef.current = JSON.stringify(signableBody, null, 2);
      setVerifyExample({
        senderPublicJwk: JSON.stringify(payload.senderPublicJwk, null, 2),
        senderSignature: payload.senderSignature,
        signatureValid: true,
      });
    } catch (e) {
      signableBodyJsonRef.current = null;
      setVerifyExample(null);
      setError(
        e instanceof Error ? e.message : 'Signature verification failed.',
      );
    } finally {
      setBusyStep(null);
    }
  }, [encryptedPayload, resetSteps]);

  const runExtractManifestFields = useCallback(async () => {
    setError(null);
    clearCryptoPath();

    const trimmed = encryptedPayload.trim();
    if (!trimmed) {
      setError('No payload: generate encrypted text in the section above.');
      return;
    }
    if (!signableBodyJsonRef.current) {
      setError('Verify the sender signature first (step 1).');
      return;
    }
    if (!mockRecipientKeyId) {
      setError('Mock recipient key id is not ready yet.');
      return;
    }

    setBusyStep('extract');
    try {
      const payload = parseManifestPayload(trimmed);
      recipientKeyIdRef.current = mockRecipientKeyId;

      if (!payload.ephemeralPublicKey) {
        throw new Error(
          'Missing ephemeralPublicKey in payload (invalid manifest).',
        );
      }

      const entry = getKeyManifestEntryForRecipient(
        payload,
        mockRecipientKeyId,
      );
      keyManifestEntryRef.current = entry;
      encryptedContentRef.current = parseEncryptedContentFromPayload(payload);

      const ephemeralJwk = JSON.stringify(payload.ephemeralPublicKey, null, 2);
      const contentIvBase64 = payload.encryptedContent.iv;
      const ciphertextBase64 = payload.encryptedContent.ciphertext;
      const entryJson = JSON.stringify(entry, null, 2);

      setEphemeralPublicKeyOutput(ephemeralJwk);
      setContentIvOutput(contentIvBase64);
      setContentCiphertextOutput(ciphertextBase64);
      setKeyManifestEntryOutput(entryJson);
    } catch (e) {
      keyManifestEntryRef.current = null;
      encryptedContentRef.current = null;
      recipientKeyIdRef.current = null;
      setEphemeralPublicKeyOutput('');
      setContentIvOutput('');
      setContentCiphertextOutput('');
      setKeyManifestEntryOutput('');
      setError(
        e instanceof Error ? e.message : 'Manifest field extraction failed.',
      );
    } finally {
      setBusyStep(null);
    }
  }, [encryptedPayload, mockRecipientKeyId, clearCryptoPath]);

  const runEcdhe = useCallback(async () => {
    setError(null);
    clearCryptoPath();

    const trimmed = encryptedPayload.trim();
    if (!trimmed) {
      setError('No payload: generate encrypted text in the section above.');
      return;
    }
    if (!keyManifestEntryRef.current || !encryptedContentRef.current) {
      setError('Extract manifest fields first (step 2).');
      return;
    }
    if (!mockPrivateKey) {
      setError('Mock private key is not ready yet.');
      return;
    }

    setBusyStep('ecdhe');
    try {
      const payload = parseManifestPayload(trimmed);
      recipientPrivateKeyRef.current = mockPrivateKey;

      const senderEphemeralPublic = await importSenderEphemeralPublicKey(
        payload.ephemeralPublicKey!,
      );
      const sharedSecret = await deriveEcdhSharedSecretBits(
        senderEphemeralPublic,
        mockPrivateKey,
      );
      sharedSecretRef.current = sharedSecret;
      const sharedSecretBase64 = bytesToBase64(new Uint8Array(sharedSecret));
      setEcdheOutput(joinLinesWithPaddedIndices([sharedSecretBase64]));

      const privateJwk = await crypto.subtle.exportKey('jwk', mockPrivateKey);
      setEcdheSharedSecretExample({
        recipientPrivateJwk: JSON.stringify(
          slimEcPrivateJwk(privateJwk),
          null,
          2,
        ),
        ephemeralPublicKey: JSON.stringify(payload.ephemeralPublicKey, null, 2),
        sharedSecretBase64,
      });
    } catch (e) {
      sharedSecretRef.current = null;
      recipientPrivateKeyRef.current = null;
      setEcdheOutput('');
      setEcdheSharedSecretExample(null);
      setError(e instanceof Error ? e.message : 'ECDHE failed.');
    } finally {
      setBusyStep(null);
    }
  }, [encryptedPayload, mockPrivateKey, clearCryptoPath]);

  const runImportHkdfMaterial = useCallback(async () => {
    setError(null);
    setHkdfMaterialOutput('');
    setImportHkdfMaterialExample(null);
    setHkdfSaltOutput('');
    setAesKekOutput('');
    setDeriveKekExample(null);
    setDekOutput('');
    setDecryptDekExample(null);
    setPlaintextOutput('');
    setDecryptContentExample(null);
    hkdfMaterialRef.current = null;
    kekRef.current = null;
    hkdfSaltRef.current = null;
    rawDekRef.current = null;

    const sharedSecret = sharedSecretRef.current;
    if (!sharedSecret) {
      setError('Run the ECDH step first (step 3).');
      return;
    }

    setBusyStep('hkdfImport');
    try {
      const hkdfKeyMaterial =
        await importSharedSecretAsHkdfKeyMaterial(sharedSecret);
      hkdfMaterialRef.current = hkdfKeyMaterial;

      const digest = await crypto.subtle.digest('SHA-256', sharedSecret);
      const fingerprint = bytesToBase64(new Uint8Array(digest));
      setHkdfMaterialOutput(joinLinesWithPaddedIndices([fingerprint]));
      setImportHkdfMaterialExample({
        sharedSecretBase64: bytesToBase64(new Uint8Array(sharedSecret)),
        hkdfMaterialFingerprintBase64: fingerprint,
      });
    } catch (e) {
      hkdfMaterialRef.current = null;
      setHkdfMaterialOutput('');
      setImportHkdfMaterialExample(null);
      setError(
        e instanceof Error ? e.message : 'HKDF key material import failed.',
      );
    } finally {
      setBusyStep(null);
    }
  }, []);

  const runDeriveKek = useCallback(async () => {
    setError(null);
    setHkdfSaltOutput('');
    setAesKekOutput('');
    setDeriveKekExample(null);
    setDekOutput('');
    setDecryptDekExample(null);
    setPlaintextOutput('');
    setDecryptContentExample(null);
    kekRef.current = null;
    hkdfSaltRef.current = null;
    rawDekRef.current = null;

    const hkdfKeyMaterial = hkdfMaterialRef.current;
    const entry = keyManifestEntryRef.current;
    const sharedSecret = sharedSecretRef.current;
    if (!hkdfKeyMaterial || !entry) {
      setError('Import HKDF key material first (step 4).');
      return;
    }

    setBusyStep('aesKek');
    try {
      const salt = new Uint8Array(base64ToBytes(entry.salt));
      hkdfSaltRef.current = salt;
      const { kek } = await deriveAesGcmKekFromHkdfMaterial(hkdfKeyMaterial, {
        salt,
        extractable: true,
        keyUsages: ['decrypt'],
      });
      kekRef.current = kek;

      const kekRaw = await crypto.subtle.exportKey('raw', kek);
      const kekBase64 = bytesToBase64(new Uint8Array(kekRaw));
      const saltBase64 = entry.salt;

      setHkdfSaltOutput(joinLinesWithPaddedIndices([saltBase64]));
      setAesKekOutput(joinLinesWithPaddedIndices([kekBase64]));

      if (sharedSecret) {
        const digest = await crypto.subtle.digest('SHA-256', sharedSecret);
        setDeriveKekExample({
          hkdfMaterialFingerprintBase64: bytesToBase64(new Uint8Array(digest)),
          hkdfSaltBase64: saltBase64,
          kekBase64,
        });
      }
    } catch (e) {
      logError('useDecryptManifestSteps.runDeriveKek', e, {
        keyId: entry?.keyId,
      });
      kekRef.current = null;
      hkdfSaltRef.current = null;
      setHkdfSaltOutput('');
      setAesKekOutput('');
      setDeriveKekExample(null);
      setError(e instanceof Error ? e.message : 'HKDF KEK derivation failed.');
    } finally {
      setBusyStep(null);
    }
  }, []);

  const runDecryptDek = useCallback(async () => {
    setError(null);
    setDekOutput('');
    setDecryptDekExample(null);
    setPlaintextOutput('');
    setDecryptContentExample(null);
    rawDekRef.current = null;

    const kek = kekRef.current;
    const entry = keyManifestEntryRef.current;
    if (!kek || !entry) {
      setError('Derive the AES KEK first (step 5).');
      return;
    }

    setBusyStep('decryptDek');
    try {
      const iv = base64ToBytes(entry.iv);
      const encryptedDek = base64ToBytes(entry.encryptedDek);
      const rawDek = await aesGcmDecryptEncryptedDek(kek, iv, encryptedDek);
      rawDekRef.current = rawDek;

      const dekBase64 = bytesToBase64(new Uint8Array(rawDek));
      const kekRaw = await crypto.subtle.exportKey('raw', kek);
      setDekOutput(joinLinesWithPaddedIndices([dekBase64]));
      setDecryptDekExample({
        kekBase64: bytesToBase64(new Uint8Array(kekRaw)),
        encryptedDekIvBase64: entry.iv,
        encryptedDekBase64: entry.encryptedDek,
        dekBase64,
      });
    } catch (e) {
      logError('useDecryptManifestSteps.runDecryptDek', e, {
        keyId: entry?.keyId,
        hasEncryptedDek: Boolean(entry?.encryptedDek),
        keyManifestEntryKeys: entry ? Object.keys(entry) : [],
      });
      rawDekRef.current = null;
      setDekOutput('');
      setDecryptDekExample(null);
      setError(e instanceof Error ? e.message : 'DEK decryption failed.');
    } finally {
      setBusyStep(null);
    }
  }, []);

  const runDecryptContent = useCallback(async () => {
    setError(null);
    setPlaintextOutput('');
    setDecryptContentExample(null);

    const rawDek = rawDekRef.current;
    const encryptedContent = encryptedContentRef.current;
    if (!rawDek || !encryptedContent) {
      setError('Decrypt the DEK first (step 6).');
      return;
    }

    setBusyStep('decrypt');
    try {
      const dek = await importManifestDek(rawDek);
      const plaintext = await aesGcmDecryptManifestBody(dek, encryptedContent);
      setPlaintextOutput(plaintext);
      setDecryptContentExample({
        dekBase64: bytesToBase64(new Uint8Array(rawDek)),
        contentIvBase64: bytesToBase64(encryptedContent.contentIv),
        ciphertextBase64: bytesToBase64(encryptedContent.ciphertext),
        plaintextMessage: plaintext,
      });
    } catch (e) {
      logError('useDecryptManifestSteps.runDecryptContent', e);
      setPlaintextOutput('');
      setDecryptContentExample(null);
      setError(e instanceof Error ? e.message : 'Message decryption failed.');
    } finally {
      setBusyStep(null);
    }
  }, []);

  const runAllSteps = useCallback(async () => {
    setError(null);
    await runVerifySignature();
    if (!signableBodyJsonRef.current) return;

    await runExtractManifestFields();
    if (!keyManifestEntryRef.current) return;

    await runEcdhe();
    if (!sharedSecretRef.current) return;

    await runImportHkdfMaterial();
    if (!hkdfMaterialRef.current) return;

    await runDeriveKek();
    if (!kekRef.current) return;

    await runDecryptDek();
    if (!rawDekRef.current) return;

    await runDecryptContent();
  }, [
    runVerifySignature,
    runExtractManifestFields,
    runEcdhe,
    runImportHkdfMaterial,
    runDeriveKek,
    runDecryptDek,
    runDecryptContent,
  ]);

  const startRunAllSteps = useCallback(() => {
    if (runAllBusy || busyStep !== null) return;
    setRunAllBusy(true);
    window.setTimeout(() => {
      void runAllSteps().finally(() => setRunAllBusy(false));
    }, 0);
  }, [runAllBusy, busyStep, runAllSteps]);

  const canRunAllSteps =
    payloadReady && decryptMockKeysReady && busyStep === null && !runAllBusy;

  return {
    keysLoading,
    payloadReady,
    decryptMockKeysReady,
    verifyExample,
    ephemeralPublicKeyOutput,
    contentIvOutput,
    contentCiphertextOutput,
    keyManifestEntryOutput,
    ecdheSharedSecretExample,
    ecdheOutput,
    importHkdfMaterialExample,
    hkdfMaterialOutput,
    deriveKekExample,
    hkdfSaltOutput,
    aesKekOutput,
    decryptDekExample,
    dekOutput,
    decryptContentExample,
    plaintextOutput,
    error,
    busyStep,
    runAllBusy,
    runAllSteps,
    startRunAllSteps,
    canRunAllSteps,
    runVerifySignature,
    runExtractManifestFields,
    runEcdhe,
    runImportHkdfMaterial,
    runDeriveKek,
    runDecryptDek,
    runDecryptContent,
    hasVerifiedSignature: Boolean(verifyExample?.signatureValid),
    hasExtractedFields: Boolean(keyManifestEntryOutput),
    hasEcdheDone: Boolean(ecdheOutput),
    hasHkdfMaterialDone: Boolean(hkdfMaterialOutput),
    hasKekDone: Boolean(aesKekOutput),
    hasDecryptedDek: Boolean(dekOutput),
  };
}
