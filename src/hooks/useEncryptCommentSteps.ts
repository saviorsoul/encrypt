import { useCallback, useRef, useState, type RefObject } from 'react';
import type { CommentSignableBody } from '@/types/comment.ts';
import type { DemoParentFeedMessage } from '@/crypto/demoFeedCommentPoC.ts';
import {
  COMMENT_HKDF_INFO,
  COMMENT_VERSION,
  COMMENT_WRAP,
} from '@/crypto/commentConstants.ts';
import { HKDF_SALT_LENGTH } from '@/crypto/manifestConstants.ts';
import {
  decryptDekFromManifestEntry,
  getKeyManifestEntryForRecipient,
  parseManifestPayload,
} from '@/crypto/manifestDecrypt.ts';
import {
  aesGcmEncryptManifestBody,
  deriveAesGcmKeyFromHkdfMaterial,
  encryptedContentToSignableBody,
  exportCryptoKeyAsJwk,
  importSharedSecretAsHkdfKeyMaterial,
  type ManifestEncryptedContent,
} from '@/crypto/manifestEncrypt.ts';
import {
  ecPublicJwkThumbprintSha256,
  slimEcPublicJwk,
} from '@/crypto/jwkThumbprint.ts';
import { assertUploadedPrivateKeyMatchesKeyId } from '@/crypto/privateKeyMaterial.ts';
import {
  isPrivateKeyFileSelectionCancelled,
  withUploadedPrivateKey,
} from '@/crypto/privateKeyFile.ts';
import { signCanonicalBody } from '@/crypto/manifestSign.ts';
import { useKeysContext } from '@/hooks/useKeysContext.ts';
import { bytesToBase64 } from '@/utils/bytes.ts';
import { stringifyManifestPayloadForDisplay } from '@/utils/formatManifestJsonForDisplay.ts';

export type ImportCommentHkdfMaterialExample = {
  dekBase64: string;
  hkdfMaterialFingerprintBase64: string;
};

export type DeriveCommentKeyExample = {
  hkdfMaterialFingerprintBase64: string;
  hkdfSaltBase64: string;
  commentKeyBase64: string;
};

export type EncryptCommentBodyExample = {
  commentKeyBase64: string;
  commentPlaintext: string;
  contentIvBase64: string;
  ciphertextBase64: string;
};

type CommentBusyStep =
  | 'deriveDek'
  | 'hkdfImport'
  | 'deriveCommentKey'
  | 'encryptBody'
  | 'assemble'
  | 'sign';

export function useEncryptCommentSteps(
  demo: DemoParentFeedMessage | null,
  getCommentPlaintextRef: RefObject<() => string>,
) {
  const keys = useKeysContext();
  const rawDekRef = useRef<ArrayBuffer | null>(null);
  const hkdfMaterialRef = useRef<CryptoKey | null>(null);
  const hkdfMaterialFingerprintRef = useRef('');
  const hkdfSaltRef = useRef<Uint8Array<ArrayBuffer> | null>(null);
  const commentKeyRef = useRef<CryptoKey | null>(null);
  const encryptedContentRef = useRef<ManifestEncryptedContent | null>(null);
  const signableBodyRef = useRef<CommentSignableBody | null>(null);

  const [dekOutput, setDekOutput] = useState('');
  const [importHkdfMaterialExample, setImportHkdfMaterialExample] =
    useState<ImportCommentHkdfMaterialExample | null>(null);
  const [hkdfMaterialFingerprintOutput, setHkdfMaterialFingerprintOutput] =
    useState('');
  const [deriveCommentKeyExample, setDeriveCommentKeyExample] =
    useState<DeriveCommentKeyExample | null>(null);
  const [hkdfSaltOutput, setHkdfSaltOutput] = useState('');
  const [commentKeyOutput, setCommentKeyOutput] = useState('');
  const [encryptCommentBodyExample, setEncryptCommentBodyExample] =
    useState<EncryptCommentBodyExample | null>(null);
  const [assemblyOutput, setAssemblyOutput] = useState('');
  const [senderSignatureOutput, setSenderSignatureOutput] = useState('');
  const [signedPayloadJson, setSignedPayloadJson] = useState('');
  const [signedPayloadDisplay, setSignedPayloadDisplay] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [errorStep, setErrorStep] = useState<CommentBusyStep | null>(null);
  const [busyStep, setBusyStep] = useState<CommentBusyStep | null>(null);

  const demoReady = Boolean(demo);
  const keysReady = Boolean(keys?.publicKey && keys?.publicKeyJwk);
  const keysLoading = Boolean(keys?.loading ?? true);

  const clearError = useCallback(() => {
    setError(null);
    setErrorStep(null);
  }, []);

  const clearFromEncryptBody = useCallback(() => {
    encryptedContentRef.current = null;
    setEncryptCommentBodyExample(null);
    signableBodyRef.current = null;
    setAssemblyOutput('');
    setSenderSignatureOutput('');
    setSignedPayloadJson('');
    setSignedPayloadDisplay('');
  }, []);

  const clearFromDeriveCommentKey = useCallback(() => {
    hkdfSaltRef.current = null;
    commentKeyRef.current = null;
    setDeriveCommentKeyExample(null);
    setHkdfSaltOutput('');
    setCommentKeyOutput('');
    clearFromEncryptBody();
  }, [clearFromEncryptBody]);

  const clearFromHkdfImport = useCallback(() => {
    hkdfMaterialRef.current = null;
    hkdfMaterialFingerprintRef.current = '';
    setImportHkdfMaterialExample(null);
    setHkdfMaterialFingerprintOutput('');
    clearFromDeriveCommentKey();
  }, [clearFromDeriveCommentKey]);

  const clearFromDeriveDek = useCallback(() => {
    rawDekRef.current = null;
    setDekOutput('');
    clearFromHkdfImport();
  }, [clearFromHkdfImport]);

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
      await withUploadedPrivateKey(async (material) => {
        assertUploadedPrivateKeyMatchesKeyId(
          material,
          demo.recipientKeyId,
          'Uploaded private key does not match your stored public key.',
        );

        const payload = parseManifestPayload(demo.parentPayload);
        const entry = getKeyManifestEntryForRecipient(payload, material.keyId);
        const { rawDek } = await decryptDekFromManifestEntry(
          entry,
          material.ecdhPrivateKey,
          payload.ephemeralPublicKey,
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

  const runImportHkdfMaterial = useCallback(async () => {
    clearError();
    clearFromHkdfImport();

    const rawDek = rawDekRef.current;
    if (!rawDek) {
      setError('Derive the message DEK first (step 1).');
      setErrorStep('hkdfImport');
      return;
    }

    setBusyStep('hkdfImport');
    try {
      const hkdfKeyMaterial = await importSharedSecretAsHkdfKeyMaterial(rawDek);
      hkdfMaterialRef.current = hkdfKeyMaterial;

      const digest = await crypto.subtle.digest('SHA-256', rawDek);
      const dekBase64 = bytesToBase64(new Uint8Array(rawDek));
      const hkdfMaterialFingerprintBase64 = bytesToBase64(
        new Uint8Array(digest),
      );

      hkdfMaterialFingerprintRef.current = hkdfMaterialFingerprintBase64;
      setHkdfMaterialFingerprintOutput(hkdfMaterialFingerprintBase64);
      setImportHkdfMaterialExample({
        dekBase64,
        hkdfMaterialFingerprintBase64,
      });
    } catch (e) {
      clearFromHkdfImport();
      setError(
        e instanceof Error ? e.message : 'HKDF key material import failed.',
      );
      setErrorStep('hkdfImport');
    } finally {
      setBusyStep(null);
    }
  }, [clearFromHkdfImport, clearError]);

  const runDeriveCommentKey = useCallback(async () => {
    clearError();
    clearFromDeriveCommentKey();

    const hkdfKeyMaterial = hkdfMaterialRef.current;
    if (!hkdfKeyMaterial) {
      setError('Import HKDF key material first (step 2).');
      setErrorStep('deriveCommentKey');
      return;
    }

    setBusyStep('deriveCommentKey');
    try {
      const hkdfSalt = crypto.getRandomValues(new Uint8Array(HKDF_SALT_LENGTH));
      hkdfSaltRef.current = hkdfSalt;
      const commentKey = await deriveAesGcmKeyFromHkdfMaterial(
        hkdfKeyMaterial,
        hkdfSalt,
        {
          info: COMMENT_HKDF_INFO,
          keyUsages: ['encrypt', 'decrypt'],
          extractable: true,
        },
      );
      commentKeyRef.current = commentKey;

      const commentKeyRaw = await crypto.subtle.exportKey('raw', commentKey);
      const hkdfSaltBase64 = bytesToBase64(hkdfSalt);
      const commentKeyBase64 = bytesToBase64(new Uint8Array(commentKeyRaw));
      const fingerprint = hkdfMaterialFingerprintRef.current;

      setHkdfSaltOutput(hkdfSaltBase64);
      setCommentKeyOutput(commentKeyBase64);
      setDeriveCommentKeyExample({
        hkdfMaterialFingerprintBase64: fingerprint,
        hkdfSaltBase64,
        commentKeyBase64,
      });
    } catch (e) {
      clearFromDeriveCommentKey();
      setError(
        e instanceof Error ? e.message : 'Failed to derive comment key.',
      );
      setErrorStep('deriveCommentKey');
    } finally {
      setBusyStep(null);
    }
  }, [clearFromDeriveCommentKey, clearError]);

  const runEncryptCommentBody = useCallback(async () => {
    clearError();
    clearFromEncryptBody();

    const commentKey = commentKeyRef.current;
    if (!commentKey) {
      setError('Derive the comment key first (step 3).');
      setErrorStep('encryptBody');
      return;
    }

    const commentPlaintext = getCommentPlaintextRef.current?.() ?? '';
    if (!commentPlaintext.trim()) {
      setError('Enter comment text.');
      setErrorStep('encryptBody');
      return;
    }

    setBusyStep('encryptBody');
    try {
      const encryptedContent = await aesGcmEncryptManifestBody(
        commentKey,
        commentPlaintext,
      );
      encryptedContentRef.current = encryptedContent;

      const commentKeyRaw = await crypto.subtle.exportKey('raw', commentKey);
      setEncryptCommentBodyExample({
        commentKeyBase64: bytesToBase64(new Uint8Array(commentKeyRaw)),
        commentPlaintext,
        contentIvBase64: bytesToBase64(encryptedContent.plaintextIv),
        ciphertextBase64: bytesToBase64(
          new Uint8Array(encryptedContent.ciphertext),
        ),
      });
    } catch (e) {
      clearFromEncryptBody();
      setError(
        e instanceof Error ? e.message : 'Failed to encrypt comment body.',
      );
      setErrorStep('encryptBody');
    } finally {
      setBusyStep(null);
    }
  }, [getCommentPlaintextRef, clearFromEncryptBody, clearError]);

  const runAssemblePayload = useCallback(async () => {
    clearError();
    signableBodyRef.current = null;
    setAssemblyOutput('');
    setSenderSignatureOutput('');
    setSignedPayloadJson('');
    setSignedPayloadDisplay('');

    if (!demo) {
      setError('Demo feed post is not ready.');
      setErrorStep('assemble');
      return;
    }

    const senderPublicKey = keys?.publicKey;
    if (!senderPublicKey) {
      setError('Keys are not ready.');
      setErrorStep('assemble');
      return;
    }

    const encryptedContent = encryptedContentRef.current;
    const hkdfSalt = hkdfSaltRef.current;
    if (!encryptedContent) {
      setError('Encrypt the comment body first (step 4).');
      setErrorStep('assemble');
      return;
    }
    if (!hkdfSalt) {
      setError('Derive the comment key first (step 3).');
      setErrorStep('assemble');
      return;
    }

    setBusyStep('assemble');
    try {
      const signableBody: CommentSignableBody = {
        version: COMMENT_VERSION,
        wrap: COMMENT_WRAP,
        parentMessageId: demo.parentMessageId,
        senderPublicJwk: await exportCryptoKeyAsJwk(senderPublicKey),
        salt: bytesToBase64(hkdfSalt),
        encryptedContent: encryptedContentToSignableBody(encryptedContent),
      };
      signableBodyRef.current = signableBody;
      setAssemblyOutput(JSON.stringify(signableBody, null, 2));
    } catch (e) {
      signableBodyRef.current = null;
      setAssemblyOutput('');
      setError(
        e instanceof Error ? e.message : 'Failed to assemble comment payload.',
      );
      setErrorStep('assemble');
    } finally {
      setBusyStep(null);
    }
  }, [demo, keys?.publicKey, clearError]);

  const runSignComment = useCallback(async () => {
    clearError();
    setSenderSignatureOutput('');
    setSignedPayloadJson('');
    setSignedPayloadDisplay('');

    const senderPublicKeyJwk = keys?.publicKeyJwk;
    if (!senderPublicKeyJwk) {
      setError('Keys are not ready.');
      setErrorStep('sign');
      return;
    }

    const signableBody = signableBodyRef.current;
    if (!signableBody) {
      setError('Assemble the comment payload first (step 5).');
      setErrorStep('sign');
      return;
    }

    setBusyStep('sign');
    try {
      await withUploadedPrivateKey(async (material) => {
        assertUploadedPrivateKeyMatchesKeyId(
          material,
          await ecPublicJwkThumbprintSha256(
            slimEcPublicJwk(senderPublicKeyJwk),
          ),
          'Uploaded private key does not match your stored public key.',
        );

        const senderSignature = await signCanonicalBody(
          material.ecdsaSignPrivateKey,
          signableBody,
        );
        const signedPayload = { senderSignature, ...signableBody };
        const signedJson = JSON.stringify(signedPayload);
        setSenderSignatureOutput(senderSignature);
        setSignedPayloadJson(signedJson);
        setSignedPayloadDisplay(
          stringifyManifestPayloadForDisplay(signedPayload),
        );
      });
    } catch (e) {
      if (isPrivateKeyFileSelectionCancelled(e)) {
        return;
      }
      setSenderSignatureOutput('');
      setSignedPayloadJson('');
      setSignedPayloadDisplay('');
      setError(e instanceof Error ? e.message : 'Failed to sign comment.');
      setErrorStep('sign');
    } finally {
      setBusyStep(null);
    }
  }, [keys?.publicKeyJwk, clearError]);

  const canRunImportHkdfMaterial = Boolean(dekOutput);
  const canRunDeriveCommentKey = Boolean(hkdfMaterialFingerprintOutput);
  const canRunEncryptBody = Boolean(commentKeyOutput);
  const canRunAssemble = Boolean(encryptCommentBodyExample);
  const hasAssemblyDone = Boolean(assemblyOutput);

  return {
    demoReady,
    keysLoading,
    keysReady,
    dekOutput,
    importHkdfMaterialExample,
    hkdfMaterialFingerprintOutput,
    deriveCommentKeyExample,
    hkdfSaltOutput,
    commentKeyOutput,
    encryptCommentBodyExample,
    assemblyOutput,
    senderSignatureOutput,
    signedPayloadJson,
    signedPayloadDisplay,
    error,
    errorStep,
    busyStep,
    runDeriveDek,
    runImportHkdfMaterial,
    runDeriveCommentKey,
    runEncryptCommentBody,
    runAssemblePayload,
    runSignComment,
    canRunImportHkdfMaterial,
    canRunDeriveCommentKey,
    canRunEncryptBody,
    canRunAssemble,
    hasAssemblyDone,
  };
}
