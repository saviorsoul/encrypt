import { useCallback, useContext, useMemo, useRef, useState } from 'react';
import { useKeysContext } from '@/hooks/useKeysContext.ts';
import {
  MOCK_EXTERNAL_RECIPIENT_COUNT,
  MockExternalRecipientContext,
} from '@/components/providers/MockExternalRecipientProvider.tsx';
import type { DemoParentFeedMessage } from '@/crypto/demoFeedCommentPoC.ts';
import {
  deriveAesGcmKekFromHkdfMaterial,
  deriveEcdhSharedSecretBits,
  encryptManifestWithPerRecipientKek,
  exportCryptoKeyAsJwk,
  generateManifestEphemeralAgreementKeyPair,
  importSharedSecretAsHkdfKeyMaterial,
  recipientsIncludingSender,
  type ManifestRecipientKeys,
  type ManifestRecipientKeysWithKek,
} from '@/crypto/manifestEncrypt.ts';
import {
  decryptDekFromManifestPayload,
  parseManifestPayload,
} from '@/crypto/manifestDecrypt.ts';
import { signManifestShareBody } from '@/crypto/manifestShare.ts';
import { verifyManifestSignature } from '@/crypto/manifestSign.ts';
import type {
  ManifestShareSignableBody,
  ManifestShareWirePayload,
} from '@/types/manifestShare.ts';
import {
  MANIFEST_SHARE_VERSION,
  MANIFEST_SHARE_WRAP,
} from '@/constants/manifestShare.ts';
import { assembleShareExportPayloadJson } from '@/crypto/exportFeedMessage.ts';
import {
  ecPublicJwkThumbprintSha256,
  slimEcPrivateJwk,
  slimEcPublicJwk,
} from '@/crypto/jwkThumbprint.ts';
import { assertUploadedPrivateKeyMatchesKeyId } from '@/crypto/privateKeyMaterial.ts';
import {
  isPrivateKeyFileSelectionCancelled,
  withUploadedPrivateKey,
} from '@/crypto/privateKeyFile.ts';
import type { KeyManifestMap } from '@/types/manifest.ts';
import { bytesToBase64 } from '@/utils/bytes.ts';
import { stringifyManifestPayloadForDisplay } from '@/utils/formatManifestJsonForDisplay.ts';
import { joinLinesWithPaddedIndices } from '@/utils/joinLinesWithPaddedIndices.ts';

export type ShareEcdheSharedSecretExample = {
  recipientLabel: string;
  ephemeralPrivateJwk: string;
  recipientPublicJwk: string;
  sharedSecretBase64: string;
};

export type ShareImportHkdfMaterialExample = {
  recipientLabel: string;
  sharedSecretBase64: string;
  hkdfMaterialFingerprintBase64: string;
};

export type ShareDeriveKekExample = {
  recipientLabel: string;
  hkdfMaterialFingerprintBase64: string;
  hkdfSaltBase64: string;
  kekBase64: string;
};

export type ShareRewrapDekExample = {
  recipientLabel: string;
  kekBase64: string;
  dekBase64: string;
  encryptedDekIvBase64: string;
  encryptedDekBase64: string;
};

type ShareBusyStep =
  | 'deriveDek'
  | 'ecdhe'
  | 'hkdfImport'
  | 'deriveKek'
  | 'rewrapDek'
  | 'assemble'
  | 'sign';

export function useShareFeedMessageSteps(demo: DemoParentFeedMessage | null) {
  const keys = useKeysContext();
  const mockExternal = useContext(MockExternalRecipientContext);

  const rawDekRef = useRef<ArrayBuffer | null>(null);
  const ephemeralAgreementRef = useRef<CryptoKeyPair | null>(null);
  const sharedSecretsRef = useRef<ArrayBuffer[] | null>(null);
  const hkdfMaterialKeysRef = useRef<CryptoKey[] | null>(null);
  const kekSetupsRef = useRef<ManifestRecipientKeysWithKek[] | null>(null);
  const keyManifestRef = useRef<KeyManifestMap | null>(null);
  const allRecipientsRef = useRef<ManifestRecipientKeys[] | null>(null);
  const signableBodyRef = useRef<ManifestShareSignableBody | null>(null);

  const [dekOutput, setDekOutput] = useState('');
  const [parentVerified, setParentVerified] = useState(false);
  const [ecdheEphemeralPrivateJwkOutput, setEcdheEphemeralPrivateJwkOutput] =
    useState('');
  const [ecdheEphemeralPublicJwkOutput, setEcdheEphemeralPublicJwkOutput] =
    useState('');
  const [ecdheOutput, setEcdheOutput] = useState('');
  const [ecdheSharedSecretExample, setEcdheSharedSecretExample] =
    useState<ShareEcdheSharedSecretExample | null>(null);
  const [hkdfMaterialOutput, setHkdfMaterialOutput] = useState('');
  const [importHkdfMaterialExample, setImportHkdfMaterialExample] =
    useState<ShareImportHkdfMaterialExample | null>(null);
  const [hkdfSaltOutput, setHkdfSaltOutput] = useState('');
  const [aesKekOutput, setAesKekOutput] = useState('');
  const [deriveKekExample, setDeriveKekExample] =
    useState<ShareDeriveKekExample | null>(null);
  const [encryptedDekIvOutput, setEncryptedDekIvOutput] = useState('');
  const [encryptedDekOutput, setEncryptedDekOutput] = useState('');
  const [rewrapDekExample, setRewrapDekExample] =
    useState<ShareRewrapDekExample | null>(null);
  const [assemblyOutput, setAssemblyOutput] = useState('');
  const [sharerSignatureOutput, setSharerSignatureOutput] = useState('');
  const [shareCoreJson, setShareCoreJson] = useState('');
  const [exportPayloadJson, setExportPayloadJson] = useState('');
  const [exportPayloadDisplay, setExportPayloadDisplay] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [errorStep, setErrorStep] = useState<ShareBusyStep | null>(null);
  const [busyStep, setBusyStep] = useState<ShareBusyStep | null>(null);

  const mockRecipients = useMemo(
    () => mockExternal?.recipients ?? [],
    [mockExternal?.recipients],
  );

  const demoReady = Boolean(demo);
  const keysReady = Boolean(
    keys?.publicKey &&
    keys?.publicKeyJwk &&
    mockRecipients.length === MOCK_EXTERNAL_RECIPIENT_COUNT &&
    mockRecipients.every((r) => r.publicKey && r.keyId),
  );
  const keysLoading =
    Boolean(keys?.loading ?? true) || Boolean(mockExternal?.loading ?? true);

  const clearError = useCallback(() => {
    setError(null);
    setErrorStep(null);
  }, []);

  const clearFromSign = useCallback(() => {
    setSharerSignatureOutput('');
    setShareCoreJson('');
    setExportPayloadJson('');
    setExportPayloadDisplay('');
  }, []);

  const clearFromAssemble = useCallback(() => {
    signableBodyRef.current = null;
    setAssemblyOutput('');
    clearFromSign();
  }, [clearFromSign]);

  const clearFromRewrapDek = useCallback(() => {
    keyManifestRef.current = null;
    setEncryptedDekIvOutput('');
    setEncryptedDekOutput('');
    setRewrapDekExample(null);
    clearFromAssemble();
  }, [clearFromAssemble]);

  const clearFromDeriveKek = useCallback(() => {
    kekSetupsRef.current = null;
    setHkdfSaltOutput('');
    setAesKekOutput('');
    setDeriveKekExample(null);
    clearFromRewrapDek();
  }, [clearFromRewrapDek]);

  const clearFromHkdfImport = useCallback(() => {
    hkdfMaterialKeysRef.current = null;
    setHkdfMaterialOutput('');
    setImportHkdfMaterialExample(null);
    clearFromDeriveKek();
  }, [clearFromDeriveKek]);

  const clearFromEcdhe = useCallback(() => {
    ephemeralAgreementRef.current = null;
    sharedSecretsRef.current = null;
    allRecipientsRef.current = null;
    setEcdheEphemeralPrivateJwkOutput('');
    setEcdheEphemeralPublicJwkOutput('');
    setEcdheOutput('');
    setEcdheSharedSecretExample(null);
    clearFromHkdfImport();
  }, [clearFromHkdfImport]);

  const clearFromDeriveDek = useCallback(() => {
    rawDekRef.current = null;
    setDekOutput('');
    setParentVerified(false);
    clearFromEcdhe();
  }, [clearFromEcdhe]);

  const runDeriveDek = useCallback(async () => {
    clearError();
    clearFromDeriveDek();

    if (!demo) {
      setError('Demo feed post is not ready.');
      setErrorStep('deriveDek');
      return;
    }

    setBusyStep('deriveDek');
    try {
      const parentPayload = demo.parentPayload;
      const parentManifest = parseManifestPayload(parentPayload);
      await verifyManifestSignature(parentManifest);
      setParentVerified(true);

      await withUploadedPrivateKey(async (material) => {
        assertUploadedPrivateKeyMatchesKeyId(
          material,
          demo.recipientKeyId,
          'Uploaded private key does not match your stored public key.',
        );

        const rawDek = await decryptDekFromManifestPayload(
          parentPayload,
          material.keyId,
          material.ecdhPrivateKey,
        );
        rawDekRef.current = rawDek;
        setDekOutput(bytesToBase64(new Uint8Array(rawDek)));
      });
    } catch (e) {
      if (isPrivateKeyFileSelectionCancelled(e)) {
        return;
      }
      clearFromDeriveDek();
      setError(
        e instanceof Error ? e.message : 'Failed to derive message DEK.',
      );
      setErrorStep('deriveDek');
    } finally {
      setBusyStep(null);
    }
  }, [demo, clearFromDeriveDek, clearError]);

  const runEcdhe = useCallback(async () => {
    clearError();
    clearFromEcdhe();

    if (!keys?.publicKey) {
      setError('Keys are not ready.');
      setErrorStep('ecdhe');
      return;
    }

    if (!rawDekRef.current) {
      setError('Derive the message DEK first (step 1).');
      setErrorStep('ecdhe');
      return;
    }

    if (mockRecipients.length !== MOCK_EXTERNAL_RECIPIENT_COUNT) {
      setError('Mock recipients are not ready.');
      setErrorStep('ecdhe');
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
      clearFromEcdhe();
      setError(e instanceof Error ? e.message : 'ECDHE failed.');
      setErrorStep('ecdhe');
    } finally {
      setBusyStep(null);
    }
  }, [keys, mockRecipients, clearFromEcdhe, clearError]);

  const runImportHkdfMaterial = useCallback(async () => {
    clearError();
    clearFromHkdfImport();

    const secrets = sharedSecretsRef.current;
    const allRecipients = allRecipientsRef.current;
    if (!secrets || !allRecipients || secrets.length !== allRecipients.length) {
      setError('Run the ECDHE step first (step 2).');
      setErrorStep('hkdfImport');
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
      clearFromHkdfImport();
      setError(
        e instanceof Error ? e.message : 'HKDF key material import failed.',
      );
      setErrorStep('hkdfImport');
    } finally {
      setBusyStep(null);
    }
  }, [mockRecipients, clearFromHkdfImport, clearError]);

  const runDeriveKeks = useCallback(async () => {
    clearError();
    clearFromDeriveKek();

    const materials = hkdfMaterialKeysRef.current;
    const secrets = sharedSecretsRef.current;
    const allRecipients = allRecipientsRef.current;
    if (
      !materials ||
      !allRecipients ||
      materials.length !== allRecipients.length
    ) {
      setError('Import HKDF key material first (step 3).');
      setErrorStep('deriveKek');
      return;
    }

    setBusyStep('deriveKek');
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
      clearFromDeriveKek();
      setError(e instanceof Error ? e.message : 'HKDF KEK derivation failed.');
      setErrorStep('deriveKek');
    } finally {
      setBusyStep(null);
    }
  }, [mockRecipients, clearFromDeriveKek, clearError]);

  const runRewrapDek = useCallback(async () => {
    clearError();
    clearFromRewrapDek();

    const setups = kekSetupsRef.current;
    const allRecipients = allRecipientsRef.current;
    const rawDek = rawDekRef.current;
    if (!setups || !allRecipients || setups.length !== allRecipients.length) {
      setError('Derive per-recipient KEKs first (step 4).');
      setErrorStep('rewrapDek');
      return;
    }
    if (!rawDek) {
      setError('Derive the message DEK first (step 1).');
      setErrorStep('rewrapDek');
      return;
    }

    setBusyStep('rewrapDek');
    try {
      const keyManifest = await encryptManifestWithPerRecipientKek(setups, {
        rawDek,
      });
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
      setRewrapDekExample({
        recipientLabel: '001',
        kekBase64: bytesToBase64(new Uint8Array(firstKekRaw)),
        dekBase64: bytesToBase64(new Uint8Array(rawDek)),
        encryptedDekIvBase64: firstEntry.iv,
        encryptedDekBase64: firstEntry.encryptedDek,
      });
    } catch (e) {
      clearFromRewrapDek();
      setError(e instanceof Error ? e.message : 'DEK re-wrap failed.');
      setErrorStep('rewrapDek');
    } finally {
      setBusyStep(null);
    }
  }, [clearFromRewrapDek, clearError]);

  const runAssembleShare = useCallback(async () => {
    clearError();
    clearFromAssemble();

    if (!demo) {
      setError('Demo feed post is not ready.');
      setErrorStep('assemble');
      return;
    }

    const sharerPublicKey = keys?.publicKey;
    const ephemeralAgreement = ephemeralAgreementRef.current;
    const keyManifest = keyManifestRef.current;
    if (!sharerPublicKey) {
      setError('Keys are not ready.');
      setErrorStep('assemble');
      return;
    }
    if (!ephemeralAgreement?.publicKey) {
      setError('Run the ECDHE step first (step 2).');
      setErrorStep('assemble');
      return;
    }
    if (!keyManifest) {
      setError('Re-wrap the DEK per recipient first (step 5).');
      setErrorStep('assemble');
      return;
    }

    setBusyStep('assemble');
    try {
      const sharerPublicJwk = await exportCryptoKeyAsJwk(sharerPublicKey);
      const ephemeralPublicKey = await exportCryptoKeyAsJwk(
        ephemeralAgreement.publicKey,
      );

      const signableBody: ManifestShareSignableBody = {
        version: MANIFEST_SHARE_VERSION,
        wrap: MANIFEST_SHARE_WRAP,
        parentMessageId: demo.parentMessageId,
        sharerPublicJwk,
        ephemeralPublicKey,
      };
      signableBodyRef.current = signableBody;

      setAssemblyOutput(stringifyManifestPayloadForDisplay(signableBody));
    } catch (e) {
      signableBodyRef.current = null;
      setAssemblyOutput('');
      setError(
        e instanceof Error ? e.message : 'Failed to assemble share payload.',
      );
      setErrorStep('assemble');
    } finally {
      setBusyStep(null);
    }
  }, [demo, keys, clearFromAssemble, clearError]);

  const runSignShare = useCallback(async () => {
    clearError();
    clearFromSign();

    if (!demo) {
      setError('Demo feed post is not ready.');
      setErrorStep('sign');
      return;
    }

    const sharerPublicKeyJwk = keys?.publicKeyJwk;
    const signableBody = signableBodyRef.current;
    const keyManifest = keyManifestRef.current;
    if (!sharerPublicKeyJwk) {
      setError('Keys are not ready.');
      setErrorStep('sign');
      return;
    }
    if (!signableBody) {
      setError('Assemble the share payload first (step 6).');
      setErrorStep('sign');
      return;
    }
    if (!keyManifest) {
      setError('Re-wrap the DEK per recipient first (step 5).');
      setErrorStep('sign');
      return;
    }

    setBusyStep('sign');
    try {
      await withUploadedPrivateKey(async (material) => {
        assertUploadedPrivateKeyMatchesKeyId(
          material,
          await ecPublicJwkThumbprintSha256(
            slimEcPublicJwk(sharerPublicKeyJwk),
          ),
          'Uploaded private key does not match your stored public key.',
        );

        const sharerSignature = await signManifestShareBody(
          material.ecdsaSignPrivateKey,
          signableBody,
        );
        setSharerSignatureOutput(sharerSignature);

        const shareCore: ManifestShareWirePayload = {
          sharerSignature,
          ...signableBody,
        };
        const shareCoreJsonValue = JSON.stringify(shareCore);
        setShareCoreJson(shareCoreJsonValue);

        const exportJson = assembleShareExportPayloadJson(
          shareCoreJsonValue,
          keyManifest,
        );
        setExportPayloadJson(exportJson);
        setExportPayloadDisplay(
          stringifyManifestPayloadForDisplay(JSON.parse(exportJson)),
        );
      });
    } catch (e) {
      if (isPrivateKeyFileSelectionCancelled(e)) {
        return;
      }
      clearFromSign();
      setError(e instanceof Error ? e.message : 'Failed to sign share.');
      setErrorStep('sign');
    } finally {
      setBusyStep(null);
    }
  }, [demo, keys, clearFromSign, clearError]);

  return {
    demoReady,
    keysLoading,
    keysReady,
    dekOutput,
    parentVerified,
    ecdheEphemeralPrivateJwkOutput,
    ecdheEphemeralPublicJwkOutput,
    ecdheOutput,
    ecdheSharedSecretExample,
    hkdfMaterialOutput,
    importHkdfMaterialExample,
    hkdfSaltOutput,
    aesKekOutput,
    deriveKekExample,
    encryptedDekIvOutput,
    encryptedDekOutput,
    rewrapDekExample,
    assemblyOutput,
    sharerSignatureOutput,
    shareCoreJson,
    exportPayloadJson,
    exportPayloadDisplay,
    error,
    errorStep,
    busyStep,
    runDeriveDek,
    runEcdhe,
    runImportHkdfMaterial,
    runDeriveKeks,
    runRewrapDek,
    runAssembleShare,
    runSignShare,
    canRunEcdhe: Boolean(dekOutput),
    canRunImportHkdfMaterial: Boolean(ecdheOutput),
    canRunDeriveKek: Boolean(hkdfMaterialOutput),
    canRunRewrapDek: Boolean(aesKekOutput),
    canRunAssemble: Boolean(encryptedDekOutput),
    hasAssemblyDone: Boolean(assemblyOutput),
  };
}

export type ShareFeedMessageSteps = ReturnType<typeof useShareFeedMessageSteps>;
