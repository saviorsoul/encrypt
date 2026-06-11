import {
  useCallback,
  useContext,
  useMemo,
  useRef,
  useState,
  type RefObject,
} from 'react';
import { useKeysContext } from '@/hooks/useKeysContext.ts';
import {
  MOCK_EXTERNAL_RECIPIENT_COUNT,
  MockExternalRecipientContext,
} from '@/components/providers/MockExternalRecipientProvider.tsx';
import {
  aesGcmEncryptManifestBody,
  buildManifestAssembly,
  deriveAesGcmKekFromHkdfMaterial,
  deriveEcdhSharedSecretBits,
  encryptManifestWithPerRecipientKek,
  generateManifestEphemeralAgreementKeyPair,
  generateManifestDek,
  importSharedSecretAsHkdfKeyMaterial,
  recipientsIncludingSender,
  type ManifestEncryptedContent,
  type ManifestDek,
  type ManifestRecipientKeys,
  type ManifestRecipientKeysWithKek,
} from '@/crypto/manifestEncrypt.ts';
import { importPrivateKeyForEcdsaSign } from '@/crypto/ecdsaKeys.ts';
import { signManifestBody } from '@/crypto/manifestSign.ts';
import {
  ecPublicJwkThumbprintSha256,
  slimEcPrivateJwk,
  slimEcPublicJwk,
} from '@/crypto/jwkThumbprint.ts';
import {
  isPrivateKeyFileSelectionCancelled,
  withUploadedPrivateKey,
} from '@/crypto/privateKeyFile.ts';
import type { KeyManifestMap, ManifestAssembly } from '@/types/manifest.ts';
import { bytesToBase64 } from '@/utils/bytes.ts';
import { stringifyManifestPayloadForDisplay } from '@/utils/formatManifestJsonForDisplay.ts';
import { joinLinesWithPaddedIndices } from '@/utils/joinLinesWithPaddedIndices.ts';

export type EncryptContentExample = {
  dekBase64: string;
  plaintextMessage: string;
  contentIvBase64: string;
  ciphertextBase64: string;
};

export type EcdheSharedSecretExample = {
  recipientLabel: string;
  ephemeralPrivateJwk: string;
  recipientPublicJwk: string;
  sharedSecretBase64: string;
};

export type ImportHkdfMaterialExample = {
  recipientLabel: string;
  sharedSecretBase64: string;
  hkdfMaterialFingerprintBase64: string;
};

export type DeriveKekExample = {
  recipientLabel: string;
  hkdfMaterialFingerprintBase64: string;
  hkdfSaltBase64: string;
  kekBase64: string;
};

export type EncryptDekExample = {
  recipientLabel: string;
  kekBase64: string;
  dekBase64: string;
  encryptedDekIvBase64: string;
  encryptedDekBase64: string;
};

export function useEncryptManifestSteps(
  getPlaintextRef: RefObject<() => string>,
) {
  const keys = useKeysContext();
  const mockExternal = useContext(MockExternalRecipientContext);

  /** ECDHE ephemeral agreement key pair created at step 2 — public half needed when building manifest. */
  const ephemeralAgreementRef = useRef<CryptoKeyPair | null>(null);
  /** Shared secrets from step 2 — one per allRecipients entry (mock first, sender last). */
  const sharedSecretsRef = useRef<ArrayBuffer[] | null>(null);
  /** HKDF-imported key material from step 3 — consumed by step 4 (HKDF expand). */
  const hkdfMaterialKeysRef = useRef<CryptoKey[] | null>(null);
  /** Recipients with KEKs + HKDF salts from step 4 — consumed by step 5 (encrypt DEK). */
  const kekSetupsRef = useRef<ManifestRecipientKeysWithKek[] | null>(null);
  /** DEK from step 1 — consumed by step 5 (encrypt DEK per recipient). */
  const dekRef = useRef<ManifestDek | null>(null);
  /** AES-GCM ciphertext from step 1 — consumed by step 6 (manifest assembly). */
  const encryptedContentRef = useRef<ManifestEncryptedContent | null>(null);
  /** Per-recipient encrypted DEKs from step 5 — consumed by step 6 (manifest assembly). */
  const keyManifestRef = useRef<KeyManifestMap | null>(null);
  /** Mock recipients, then sender when included (step 2 onward). */
  const allRecipientsRef = useRef<ManifestRecipientKeys[] | null>(null);
  /** Manifest assembly from step 6 — consumed by step 7 (sign manifest). */
  const assemblyRef = useRef<ManifestAssembly | null>(null);
  /** Set when step 7 produces a signed payload (for run-all). */
  const signedPayloadReadyRef = useRef(false);
  const [ecdheEphemeralPrivateJwkOutput, setEcdheEphemeralPrivateJwkOutput] =
    useState('');
  const [ecdheEphemeralPublicJwkOutput, setEcdheEphemeralPublicJwkOutput] =
    useState('');
  const [ecdheOutput, setEcdheOutput] = useState('');
  /** SHA-256 fingerprints of ECDHE secrets used as HKDF key material (per recipient). */
  const [hkdfMaterialOutput, setHkdfMaterialOutput] = useState('');
  const [hkdfSaltOutput, setHkdfSaltOutput] = useState('');
  const [aesKekOutput, setAesKekOutput] = useState('');
  const [aesDekOutput, setAesDekOutput] = useState('');
  const [aesContentIvOutput, setAesContentIvOutput] = useState('');
  const [aesContentCiphertextOutput, setAesContentCiphertextOutput] =
    useState('');
  const [encryptedDekIvOutput, setEncryptedDekIvOutput] = useState('');
  const [encryptedDekOutput, setEncryptedDekOutput] = useState('');
  const [encryptContentExample, setEncryptContentExample] =
    useState<EncryptContentExample | null>(null);
  const [ecdheSharedSecretExample, setEcdheSharedSecretExample] =
    useState<EcdheSharedSecretExample | null>(null);
  const [importHkdfMaterialExample, setImportHkdfMaterialExample] =
    useState<ImportHkdfMaterialExample | null>(null);
  const [deriveKekExample, setDeriveKekExample] =
    useState<DeriveKekExample | null>(null);
  const [encryptDekExample, setEncryptDekExample] =
    useState<EncryptDekExample | null>(null);
  const [assemblyOutput, setAssemblyOutput] = useState('');
  const [senderSignatureOutput, setSenderSignatureOutput] = useState('');
  const [aesOutput, setAesOutput] = useState('');
  const [signedPayloadJson, setSignedPayloadJson] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [busyStep, setBusyStep] = useState<
    | 'ecdhe'
    | 'hkdfImport'
    | 'aesKek'
    | 'aesContent'
    | 'encryptDek'
    | 'manifest'
    | 'signManifest'
    | null
  >(null);
  const [runAllBusy, setRunAllBusy] = useState(false);

  const mockRecipients = useMemo(
    () => mockExternal?.recipients ?? [],
    [mockExternal?.recipients],
  );

  const keysReady = Boolean(
    keys?.publicKey &&
    mockRecipients.length === MOCK_EXTERNAL_RECIPIENT_COUNT &&
    mockRecipients.every((r) => r.publicKey && r.keyId),
  );

  const keysLoading =
    Boolean(keys?.loading ?? true) || Boolean(mockExternal?.loading ?? true);

  const clearSignedPayloadDisplay = useCallback(() => {
    signedPayloadReadyRef.current = false;
    setSignedPayloadJson('');
    setAesOutput('');
    setSenderSignatureOutput('');
  }, []);

  const clearManifestOutputs = useCallback(() => {
    assemblyRef.current = null;
    setAssemblyOutput('');
    setSignedPayloadJson('');
    setAesOutput('');
    setSenderSignatureOutput('');
  }, []);

  const clearEncryptedDekOutputs = useCallback(() => {
    keyManifestRef.current = null;
    setEncryptedDekIvOutput('');
    setEncryptedDekOutput('');
    setEncryptDekExample(null);
    clearManifestOutputs();
  }, [clearManifestOutputs]);

  const clearKekOutputs = useCallback(() => {
    kekSetupsRef.current = null;
    setHkdfSaltOutput('');
    setAesKekOutput('');
    setDeriveKekExample(null);
    clearEncryptedDekOutputs();
  }, [clearEncryptedDekOutputs]);

  const resetSteps = useCallback(() => {
    ephemeralAgreementRef.current = null;
    sharedSecretsRef.current = null;
    hkdfMaterialKeysRef.current = null;
    kekSetupsRef.current = null;
    dekRef.current = null;
    encryptedContentRef.current = null;
    keyManifestRef.current = null;
    allRecipientsRef.current = null;
    clearManifestOutputs();
    setEcdheEphemeralPrivateJwkOutput('');
    setEcdheEphemeralPublicJwkOutput('');
    setEcdheOutput('');
    setHkdfMaterialOutput('');
    setHkdfSaltOutput('');
    setAesKekOutput('');
    setEncryptContentExample(null);
    setEcdheSharedSecretExample(null);
    setImportHkdfMaterialExample(null);
    setDeriveKekExample(null);
    setAesDekOutput('');
    setAesContentIvOutput('');
    setAesContentCiphertextOutput('');
    setEncryptedDekIvOutput('');
    setEncryptedDekOutput('');
    setEncryptDekExample(null);
    setError(null);
  }, [clearManifestOutputs]);

  const runEcdhe = useCallback(async () => {
    setError(null);
    setHkdfMaterialOutput('');
    setHkdfSaltOutput('');
    setAesKekOutput('');
    setImportHkdfMaterialExample(null);
    setDeriveKekExample(null);
    clearEncryptedDekOutputs();
    ephemeralAgreementRef.current = null;
    sharedSecretsRef.current = null;
    allRecipientsRef.current = null;
    hkdfMaterialKeysRef.current = null;
    kekSetupsRef.current = null;
    setEcdheEphemeralPrivateJwkOutput('');
    setEcdheEphemeralPublicJwkOutput('');
    setEcdheOutput('');
    setEcdheSharedSecretExample(null);

    if (
      !keys?.publicKey ||
      mockRecipients.length !== MOCK_EXTERNAL_RECIPIENT_COUNT
    ) {
      setError('Keys are not ready.');
      return;
    }

    setBusyStep('ecdhe');
    try {
      const allRecipients = await recipientsIncludingSender(
        mockRecipients.map(({ keyId, publicKey }) => ({ keyId, publicKey })),
        keys.publicKey,
      );
      allRecipientsRef.current = allRecipients;

      const ephemeral = await generateManifestEphemeralAgreementKeyPair();
      ephemeralAgreementRef.current = ephemeral;
      const bitsList = await Promise.all(
        allRecipients.map((r) =>
          deriveEcdhSharedSecretBits(r.publicKey, ephemeral.privateKey),
        ),
      );
      sharedSecretsRef.current = bitsList;
      const firstRecipient = mockRecipients[0];
      const [privateJwk, publicJwk, recipientPublicJwk] = await Promise.all([
        crypto.subtle.exportKey('jwk', ephemeral.privateKey),
        crypto.subtle.exportKey('jwk', ephemeral.publicKey),
        firstRecipient
          ? crypto.subtle.exportKey('jwk', firstRecipient.publicKey)
          : Promise.resolve(null),
      ]);
      const slimPrivateJwk = slimEcPrivateJwk(privateJwk);
      const slimPublicJwk = slimEcPublicJwk(publicJwk);
      setEcdheEphemeralPrivateJwkOutput(
        JSON.stringify(slimPrivateJwk, null, 2),
      );
      setEcdheEphemeralPublicJwkOutput(JSON.stringify(slimPublicJwk, null, 2));
      const lines = bitsList.map((bits) => bytesToBase64(new Uint8Array(bits)));
      setEcdheOutput(joinLinesWithPaddedIndices(lines));

      const firstSecret = bitsList[0];
      if (firstRecipient && firstSecret && recipientPublicJwk) {
        setEcdheSharedSecretExample({
          recipientLabel: '001',
          ephemeralPrivateJwk: JSON.stringify(slimPrivateJwk, null, 2),
          recipientPublicJwk: JSON.stringify(
            slimEcPublicJwk(recipientPublicJwk),
            null,
            2,
          ),
          sharedSecretBase64: bytesToBase64(new Uint8Array(firstSecret)),
        });
      }
    } catch (e) {
      ephemeralAgreementRef.current = null;
      sharedSecretsRef.current = null;
      allRecipientsRef.current = null;
      setEcdheEphemeralPrivateJwkOutput('');
      setEcdheEphemeralPublicJwkOutput('');
      setEcdheOutput('');
      setEcdheSharedSecretExample(null);
      setError(e instanceof Error ? e.message : 'ECDHE failed.');
    } finally {
      setBusyStep(null);
    }
  }, [keys, mockRecipients, clearEncryptedDekOutputs]);

  const runImportHkdfMaterial = useCallback(async () => {
    setError(null);
    setHkdfMaterialOutput('');
    setImportHkdfMaterialExample(null);
    clearKekOutputs();
    hkdfMaterialKeysRef.current = null;

    const secrets = sharedSecretsRef.current;
    const allRecipients = allRecipientsRef.current;
    if (!secrets || !allRecipients || secrets.length !== allRecipients.length) {
      setError('Run the ECDHE step first (step 2).');
      return;
    }

    setBusyStep('hkdfImport');
    try {
      const materials = await Promise.all(
        secrets.map((shared) => importSharedSecretAsHkdfKeyMaterial(shared)),
      );
      hkdfMaterialKeysRef.current = materials;

      const digestLines = await Promise.all(
        secrets.map(async (shared) => {
          const digest = await crypto.subtle.digest('SHA-256', shared);
          return bytesToBase64(new Uint8Array(digest));
        }),
      );
      setHkdfMaterialOutput(joinLinesWithPaddedIndices(digestLines));

      const firstRecipient = mockRecipients[0];
      const firstSecret = secrets[0];
      if (firstRecipient && firstSecret) {
        const digest = await crypto.subtle.digest('SHA-256', firstSecret);
        setImportHkdfMaterialExample({
          recipientLabel: '001',
          sharedSecretBase64: bytesToBase64(new Uint8Array(firstSecret)),
          hkdfMaterialFingerprintBase64: bytesToBase64(new Uint8Array(digest)),
        });
      }
    } catch (e) {
      hkdfMaterialKeysRef.current = null;
      setHkdfMaterialOutput('');
      setImportHkdfMaterialExample(null);
      setError(
        e instanceof Error ? e.message : 'HKDF key material import failed.',
      );
    } finally {
      setBusyStep(null);
    }
  }, [mockRecipients, clearKekOutputs]);

  const runDeriveAesKeks = useCallback(async () => {
    setError(null);
    setHkdfSaltOutput('');
    setAesKekOutput('');
    setDeriveKekExample(null);
    clearEncryptedDekOutputs();
    kekSetupsRef.current = null;

    const materials = hkdfMaterialKeysRef.current;
    const secrets = sharedSecretsRef.current;
    const allRecipients = allRecipientsRef.current;
    if (
      !materials ||
      !allRecipients ||
      materials.length !== allRecipients.length
    ) {
      setError('Import HKDF key material first (step 3).');
      return;
    }

    setBusyStep('aesKek');
    try {
      const perRecipientKek = await Promise.all(
        materials.map((hkdfKeyMaterial) =>
          deriveAesGcmKekFromHkdfMaterial(hkdfKeyMaterial, {
            extractable: true,
          }),
        ),
      );

      kekSetupsRef.current = allRecipients.map((r, i) => ({
        ...r,
        ...perRecipientKek[i],
      }));

      const saltLines = perRecipientKek.map((p) => bytesToBase64(p.hkdfSalt));

      const keyRawList = await Promise.all(
        perRecipientKek.map((p) => crypto.subtle.exportKey('raw', p.kek)),
      );
      const keyLines = keyRawList.map((raw) =>
        bytesToBase64(new Uint8Array(raw)),
      );
      setHkdfSaltOutput(joinLinesWithPaddedIndices(saltLines));
      setAesKekOutput(joinLinesWithPaddedIndices(keyLines));

      const firstRecipient = mockRecipients[0];
      const firstKek = perRecipientKek[0];
      const firstSecret = secrets?.[0];
      if (firstRecipient && firstKek && firstSecret) {
        const digest = await crypto.subtle.digest('SHA-256', firstSecret);
        setDeriveKekExample({
          recipientLabel: '001',
          hkdfMaterialFingerprintBase64: bytesToBase64(new Uint8Array(digest)),
          hkdfSaltBase64: bytesToBase64(firstKek.hkdfSalt),
          kekBase64: keyLines[0] ?? '',
        });
      }
    } catch (e) {
      clearKekOutputs();
      setError(e instanceof Error ? e.message : 'HKDF KEK derivation failed.');
    } finally {
      setBusyStep(null);
    }
  }, [mockRecipients, clearEncryptedDekOutputs, clearKekOutputs]);

  const runGenerateDekAndEncrypt = useCallback(async () => {
    setError(null);
    setAesDekOutput('');
    setAesContentIvOutput('');
    setAesContentCiphertextOutput('');
    setEncryptContentExample(null);
    clearEncryptedDekOutputs();
    dekRef.current = null;
    encryptedContentRef.current = null;

    const plain = getPlaintextRef.current?.().trim() ?? '';
    if (!plain) {
      setError('Enter a message to encrypt.');
      return;
    }

    setBusyStep('aesContent');
    try {
      const dekMaterial = await generateManifestDek();
      dekRef.current = dekMaterial;
      setAesDekOutput(bytesToBase64(new Uint8Array(dekMaterial.rawDek)));

      const encryptedContent = await aesGcmEncryptManifestBody(
        dekMaterial.dek,
        plain,
      );
      encryptedContentRef.current = encryptedContent;
      const dekBase64 = bytesToBase64(new Uint8Array(dekMaterial.rawDek));
      const contentIvBase64 = bytesToBase64(encryptedContent.plaintextIv);
      const ciphertextBase64 = bytesToBase64(
        new Uint8Array(encryptedContent.ciphertext),
      );
      setAesContentIvOutput(contentIvBase64);
      setAesContentCiphertextOutput(ciphertextBase64);
      setEncryptContentExample({
        dekBase64,
        plaintextMessage: plain,
        contentIvBase64,
        ciphertextBase64,
      });
    } catch (e) {
      dekRef.current = null;
      encryptedContentRef.current = null;
      setAesDekOutput('');
      setAesContentIvOutput('');
      setAesContentCiphertextOutput('');
      setEncryptContentExample(null);
      setError(
        e instanceof Error
          ? e.message
          : 'DEK generation or message encryption failed.',
      );
    } finally {
      setBusyStep(null);
    }
  }, [getPlaintextRef, clearEncryptedDekOutputs]);

  const runEncryptDekPerRecipient = useCallback(async () => {
    setError(null);
    clearEncryptedDekOutputs();

    const setups = kekSetupsRef.current;
    const allRecipients = allRecipientsRef.current;
    if (!setups || !allRecipients || setups.length !== allRecipients.length) {
      setError('Derive AES KEKs first (step 4).');
      return;
    }

    const dekMaterial = dekRef.current;
    if (!dekMaterial) {
      setError('Generate DEK and encrypt the message first (step 1).');
      return;
    }

    setBusyStep('encryptDek');
    try {
      const keyManifest = await encryptManifestWithPerRecipientKek(
        setups,
        dekMaterial,
      );
      keyManifestRef.current = keyManifest;

      const entriesInOrder = setups.map((r) => keyManifest[r.keyId]);
      const wrapIvLines = entriesInOrder.map((entry) => entry.iv);
      const encryptedDekLines = entriesInOrder.map(
        (entry) => entry.encryptedDek,
      );
      setEncryptedDekIvOutput(joinLinesWithPaddedIndices(wrapIvLines));
      setEncryptedDekOutput(joinLinesWithPaddedIndices(encryptedDekLines));

      const firstSetup = setups[0];
      const firstEntry = entriesInOrder[0];
      const firstKekRaw = await crypto.subtle.exportKey('raw', firstSetup.kek);
      setEncryptDekExample({
        recipientLabel: '001',
        kekBase64: bytesToBase64(new Uint8Array(firstKekRaw)),
        dekBase64: bytesToBase64(new Uint8Array(dekMaterial.rawDek)),
        encryptedDekIvBase64: firstEntry.iv,
        encryptedDekBase64: firstEntry.encryptedDek,
      });
    } catch (e) {
      clearEncryptedDekOutputs();
      setError(e instanceof Error ? e.message : 'DEK encryption failed.');
    } finally {
      setBusyStep(null);
    }
  }, [clearEncryptedDekOutputs]);

  const runBuildManifest = useCallback(async () => {
    setError(null);
    clearSignedPayloadDisplay();
    assemblyRef.current = null;
    setAssemblyOutput('');

    const senderPublicKey = keys?.publicKey;
    const ephemeralAgreement = ephemeralAgreementRef.current;
    if (!senderPublicKey) {
      setError('Keys are not ready.');
      return;
    }
    if (!ephemeralAgreement?.publicKey) {
      setError(
        'Run the ECDHE step first (step 2; manifest ephemeral agreement key missing).',
      );
      return;
    }

    const encryptedContent = encryptedContentRef.current;
    if (!encryptedContent) {
      setError('Generate DEK and encrypt the message first (step 1).');
      return;
    }

    const keyManifest = keyManifestRef.current;
    if (!keyManifest) {
      setError('Encrypt the DEK per recipient first (step 5).');
      return;
    }

    setBusyStep('manifest');
    try {
      const assembly = await buildManifestAssembly(
        senderPublicKey,
        ephemeralAgreement.publicKey,
        encryptedContent,
        keyManifest,
      );
      assemblyRef.current = assembly;
      setAssemblyOutput(stringifyManifestPayloadForDisplay(assembly));
    } catch (e) {
      assemblyRef.current = null;
      setAssemblyOutput('');
      setError(e instanceof Error ? e.message : 'Manifest assembly failed.');
    } finally {
      setBusyStep(null);
    }
  }, [keys?.publicKey, clearSignedPayloadDisplay]);

  const runSignManifest = useCallback(async () => {
    setError(null);
    clearSignedPayloadDisplay();

    const senderPublicKeyJwk = keys?.publicKeyJwk;
    const signableBody = assemblyRef.current;
    if (!senderPublicKeyJwk) {
      setError('Keys are not ready.');
      return;
    }
    if (!signableBody) {
      setError('Assemble the manifest JSON first (step 6).');
      return;
    }

    setBusyStep('signManifest');
    try {
      await withUploadedPrivateKey(async (_ecdhPrivateKey, privateJwk) => {
        const uploadedKeyId = await ecPublicJwkThumbprintSha256(
          slimEcPublicJwk(privateJwk),
        );
        const expectedKeyId = await ecPublicJwkThumbprintSha256(
          slimEcPublicJwk(senderPublicKeyJwk),
        );
        if (uploadedKeyId !== expectedKeyId) {
          throw new Error(
            'Uploaded private key does not match your stored public key.',
          );
        }

        const senderSigningPrivateKey =
          await importPrivateKeyForEcdsaSign(privateJwk);
        const senderSignature = await signManifestBody(
          senderSigningPrivateKey,
          signableBody,
        );
        setSenderSignatureOutput(senderSignature);
        const signedPayload = { senderSignature, ...signableBody };
        const signedJson = JSON.stringify(signedPayload);
        signedPayloadReadyRef.current = true;
        setSignedPayloadJson(signedJson);
        setAesOutput(stringifyManifestPayloadForDisplay(signedPayload));
      });
    } catch (e) {
      if (isPrivateKeyFileSelectionCancelled(e)) {
        return;
      }
      signedPayloadReadyRef.current = false;
      setError(e instanceof Error ? e.message : 'Manifest signing failed.');
      setSignedPayloadJson('');
      setAesOutput('');
      setSenderSignatureOutput('');
    } finally {
      setBusyStep(null);
    }
  }, [keys?.publicKeyJwk, clearSignedPayloadDisplay]);

  const runAllSteps = useCallback(async () => {
    setError(null);
    await runGenerateDekAndEncrypt();
    if (!encryptedContentRef.current) return;

    await runEcdhe();
    if (!sharedSecretsRef.current) return;

    await runImportHkdfMaterial();
    if (!hkdfMaterialKeysRef.current) return;

    await runDeriveAesKeks();
    if (!kekSetupsRef.current) return;

    await runEncryptDekPerRecipient();
    if (!keyManifestRef.current) return;

    await runBuildManifest();
    if (!assemblyRef.current) return;
  }, [
    runGenerateDekAndEncrypt,
    runEcdhe,
    runImportHkdfMaterial,
    runDeriveAesKeks,
    runEncryptDekPerRecipient,
    runBuildManifest,
  ]);

  const startRunAllSteps = useCallback(() => {
    if (runAllBusy || busyStep !== null) return;
    setRunAllBusy(true);
    window.setTimeout(() => {
      runAllSteps().finally(() => setRunAllBusy(false));
    }, 0);
  }, [runAllBusy, busyStep, runAllSteps]);

  const canRunAllSteps = keysReady && busyStep === null && !runAllBusy;

  return {
    keysLoading,
    keysReady,
    ecdheEphemeralPrivateJwkOutput,
    ecdheEphemeralPublicJwkOutput,
    ecdheOutput,
    hkdfMaterialOutput,
    hkdfSaltOutput,
    aesKekOutput,
    aesDekOutput,
    aesContentIvOutput,
    aesContentCiphertextOutput,
    encryptedDekIvOutput,
    encryptedDekOutput,
    encryptContentExample,
    ecdheSharedSecretExample,
    importHkdfMaterialExample,
    deriveKekExample,
    encryptDekExample,
    assemblyOutput,
    senderSignatureOutput,
    aesOutput,
    signedPayloadJson,
    error,
    busyStep,
    runAllBusy,
    resetSteps,
    runAllSteps,
    startRunAllSteps,
    canRunAllSteps,
    runEcdhe,
    runImportHkdfMaterial,
    runDeriveAesKeks,
    runGenerateDekAndEncrypt,
    runEncryptDekPerRecipient,
    runBuildManifest,
    runSignManifest,
    canRunImportHkdfMaterial: Boolean(ecdheOutput),
    canRunDeriveKeks: Boolean(hkdfMaterialOutput),
    hasKeksDone: Boolean(aesKekOutput),
    hasEncryptedContentDone: Boolean(aesContentCiphertextOutput),
    hasEncryptedDekDone: Boolean(encryptedDekOutput),
    hasAssemblyDone: Boolean(assemblyOutput),
    hasManifestSignedDone: Boolean(senderSignatureOutput),
  };
}
