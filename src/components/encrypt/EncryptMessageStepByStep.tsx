import React, {
  memo,
  useCallback,
  useEffect,
  useRef,
  useState,
  type RefObject,
} from 'react';
import Box from '@mui/material/Box';
import Button from '@mui/material/Button';
import Typography from '@mui/material/Typography';
import CircularProgress from '@mui/material/CircularProgress';
import { stepContentSx } from '@/components/manifest-steps/stepLayout.ts';
import { StepActionRow } from '@/components/manifest-steps/StepActionRow.tsx';
import { StepInfoAlert } from '@/components/manifest-steps/StepInfoAlert.tsx';
import { StepExampleGrid } from '@/components/manifest-steps/StepExampleGrid.tsx';
import { StepOutputTextField } from '@/components/manifest-steps/StepOutputTextField.tsx';
import { MOCK_EXTERNAL_RECIPIENT_COUNT } from '@/components/providers/MockExternalRecipientProvider.tsx';
import { MockRecipientsChip } from '@/components/encrypt/MockRecipientsChip.tsx';
import {
  useEncryptManifestSteps,
  type DeriveKekExample,
  type EcdheSharedSecretExample,
  type EncryptContentExample,
  type ImportHkdfMaterialExample,
  type EncryptDekExample,
} from '@/hooks/useEncryptManifestSteps.ts';
import type { CopyState } from '@/types/copyState.ts';

type EncryptMessageStepByStepProps = {
  onOutputChange?: (payload: string) => void;
};

function encryptPerRecipientLinesLabel(description: string): string {
  const last = String(MOCK_EXTERNAL_RECIPIENT_COUNT).padStart(3, '0');
  return `${description}, lines 001–${last} + sender`;
}

const DEFAULT_LOREM_IPSUM_MESSAGE =
  'Lorem ipsum dolor sit amet, consectetur adipiscing elit, sed do eiusmod tempor incididunt ut labore et dolore magna aliqua. Ut enim ad minim veniam, quis nostrud exercitation ullamco laboris nisi ut aliquip ex ea commodo consequat. Duis aute irure dolor in reprehenderit in voluptate velit esse cillum dolore eu fugiat nulla pariatur. Excepteur sint occaecat cupidatat non proident, sunt in culpa qui officia deserunt mollit anim id est laborum. Lorem ipsum dolor sit amet, consectetur adipiscing elit, sed do eiusmod tempor incididunt ut labore et dolore magna aliqua. Ut enim ad minim veniam, quis nostrud exercitation ullamco laboris nisi ut aliquip ex ea commodo consequat. Duis aute irure dolor in reprehenderit in voluptate velit esse cillum dolore eu fugiat nulla pariatur. Excepteur sint occaecat cupidatat non proident, sunt in culpa qui officia deserunt mollit anim id est laborum. Lorem ipsum dolor sit amet, consectetur adipiscing elit, sed do eiusmod tempor incididunt ut labore et dolor';

/** Local message state so keystrokes do not re-render large step output fields. */
const PlaintextMessageInput = memo(function PlaintextMessageInput({
  getPlaintextRef,
}: {
  getPlaintextRef: RefObject<() => string>;
}) {
  const [message, setMessage] = useState(DEFAULT_LOREM_IPSUM_MESSAGE);

  useEffect(() => {
    getPlaintextRef.current = () => message;
  });

  return (
    <StepOutputTextField
      label="Plaintext message"
      value={message}
      onChange={(e) => setMessage(e.target.value)}
      multiline
      rows={4}
      fullWidth
    />
  );
});

type StepsPanelProps = ReturnType<typeof useEncryptManifestSteps>;

function EncryptContentExampleCaption({
  example,
  getPlaintextRef,
}: {
  example: EncryptContentExample | null;
  getPlaintextRef: RefObject<() => string>;
}) {
  const dekBase64 = example?.dekBase64 ?? '';
  const contentIvBase64 = example?.contentIvBase64 ?? '';
  const ciphertextBase64 = example?.ciphertextBase64 ?? '';

  return (
    <StepExampleGrid>
      <PlaintextMessageInput getPlaintextRef={getPlaintextRef} />

      <Typography
        variant="body2"
        color="text.secondary"
        sx={{ textAlign: 'center', px: { md: 0.5 } }}
      >
        +
      </Typography>

      <Box sx={{ display: 'flex', flexDirection: 'column', gap: 1 }}>
        <StepOutputTextField
          color="secondary"
          tooltipMessage="DEK needs to be encrypted with the per-recipient KEKs in step 5"
          label="Random AES-256 DEK"
          value={dekBase64}
          multiline
          minRows={2}
          maxRows={4}
          fullWidth
          slotProps={{ input: { readOnly: true } }}
        />

        <StepOutputTextField
          color="success"
          tooltipMessage="Included in payload"
          label="Random content IV (nonce)"
          value={contentIvBase64}
          multiline
          rows={1}
          fullWidth
          slotProps={{ input: { readOnly: true } }}
        />
      </Box>

      <Typography
        variant="body2"
        color="text.secondary"
        sx={{ textAlign: 'center', px: { md: 0.5 } }}
      >
        → AES-GCM →
      </Typography>
      <StepOutputTextField
        color="success"
        tooltipMessage="Included in payload"
        label="Content ciphertext"
        value={ciphertextBase64}
        multiline
        rows={4}
        fullWidth
        slotProps={{ input: { readOnly: true } }}
      />
    </StepExampleGrid>
  );
}

function EcdheSharedSecretExampleCaption({
  example,
}: {
  example: EcdheSharedSecretExample | null;
}) {
  const recipientLabel = example?.recipientLabel ?? '001';
  const ephemeralPrivateJwk = example?.ephemeralPrivateJwk ?? '';
  const recipientPublicJwk = example?.recipientPublicJwk ?? '';
  const sharedSecretBase64 = example?.sharedSecretBase64 ?? '';

  return (
    <StepExampleGrid>
      <StepOutputTextField
        tooltipMessage="Not saved anywhere. It's discarded after creating the shared secret"
        label="Ephemeral agreement private key"
        value={ephemeralPrivateJwk}
        multiline
        rows={7}
        fullWidth
        slotProps={{ input: { readOnly: true } }}
      />
      <Typography
        variant="body2"
        color="text.secondary"
        sx={{ textAlign: 'center', px: { md: 0.5 } }}
      >
        +
      </Typography>
      <StepOutputTextField
        color="success"
        tooltipMessage="Included in payload"
        label={`Recipient ${recipientLabel} public key (long-term ECDH)`}
        value={recipientPublicJwk}
        multiline
        rows={6}
        fullWidth
        slotProps={{ input: { readOnly: true } }}
      />
      <Typography
        variant="body2"
        color="text.secondary"
        sx={{ textAlign: 'center', px: { md: 0.5 } }}
      >
        → ECDH →
      </Typography>
      <StepOutputTextField
        color="error"
        tooltipMessage="Included in payload"
        label={`Shared secret (recipient ${recipientLabel})`}
        value={sharedSecretBase64}
        multiline
        minRows={2}
        maxRows={4}
        fullWidth
        slotProps={{ input: { readOnly: true } }}
      />
    </StepExampleGrid>
  );
}

function ImportHkdfMaterialExampleCaption({
  example,
}: {
  example: ImportHkdfMaterialExample | null;
}) {
  const recipientLabel = example?.recipientLabel ?? '001';
  const sharedSecretBase64 = example?.sharedSecretBase64 ?? '';
  const hkdfMaterialFingerprintBase64 =
    example?.hkdfMaterialFingerprintBase64 ?? '';

  return (
    <StepExampleGrid columns={3}>
      <StepOutputTextField
        color="error"
        label={`Shared secret (recipient ${recipientLabel})`}
        value={sharedSecretBase64}
        multiline
        minRows={2}
        maxRows={4}
        fullWidth
        slotProps={{ input: { readOnly: true } }}
      />
      <Typography
        variant="body2"
        color="text.secondary"
        sx={{ textAlign: 'center', px: { md: 0.5 } }}
      >
        → prepare for HKDF →
      </Typography>
      <StepOutputTextField
        label={`HKDF key material (recipient ${recipientLabel}, SHA-256 fingerprint of shared secret)`}
        value={hkdfMaterialFingerprintBase64}
        multiline
        minRows={2}
        maxRows={4}
        fullWidth
        slotProps={{
          input: { readOnly: true },
        }}
      />
    </StepExampleGrid>
  );
}

function DeriveKekExampleCaption({
  example,
}: {
  example: DeriveKekExample | null;
}) {
  const recipientLabel = example?.recipientLabel ?? '001';
  const hkdfMaterialFingerprintBase64 =
    example?.hkdfMaterialFingerprintBase64 ?? '';
  const hkdfSaltBase64 = example?.hkdfSaltBase64 ?? '';
  const kekBase64 = example?.kekBase64 ?? '';

  return (
    <StepExampleGrid>
      <StepOutputTextField
        label={`HKDF material (step 3, recipient ${recipientLabel}, SHA-256 of ECDHE secret)`}
        value={hkdfMaterialFingerprintBase64}
        multiline
        minRows={2}
        maxRows={4}
        fullWidth
        slotProps={{
          input: { readOnly: true },
        }}
      />
      <Typography
        variant="body2"
        color="text.secondary"
        sx={{ textAlign: 'center', px: { md: 0.5 } }}
      >
        +
      </Typography>
      <StepOutputTextField
        color="success"
        tooltipMessage="Random salt in HKDF-Extract is standard when input key material may not be uniformly random. ECDH output can be biased; random salt helps extract strong key material from it.<br /><br />Included in payload"
        label={`Random HKDF salt (nonce) (recipient ${recipientLabel})`}
        value={hkdfSaltBase64}
        multiline
        minRows={2}
        maxRows={4}
        fullWidth
        slotProps={{ input: { readOnly: true } }}
      />
      <Typography
        variant="body2"
        color="text.secondary"
        sx={{ textAlign: 'center', px: { md: 0.5 } }}
      >
        → HKDF expand →
      </Typography>
      <StepOutputTextField
        label={`AES-256 KEK (recipient ${recipientLabel})`}
        value={kekBase64}
        multiline
        minRows={2}
        maxRows={4}
        fullWidth
        slotProps={{ input: { readOnly: true } }}
      />
    </StepExampleGrid>
  );
}

function EncryptDekExampleCaption({
  example,
}: {
  example: EncryptDekExample | null;
}) {
  const recipientLabel = example?.recipientLabel ?? '001';
  const kekBase64 = example?.kekBase64 ?? '';
  const dekBase64 = example?.dekBase64 ?? '';
  const encryptedDekIvBase64 = example?.encryptedDekIvBase64 ?? '';
  const encryptedDekBase64 = example?.encryptedDekBase64 ?? '';

  return (
    <StepExampleGrid>
      <Box sx={{ display: 'flex', flexDirection: 'column', gap: 1 }}>
        <StepOutputTextField
          label={`KEK (step 4, recipient ${recipientLabel})`}
          value={kekBase64}
          multiline
          minRows={2}
          maxRows={4}
          fullWidth
          slotProps={{ input: { readOnly: true } }}
        />
        <StepOutputTextField
          color="success"
          tooltipMessage="Included in payload"
          label={`Random KEK IV (nonce) (recipient ${recipientLabel})`}
          value={encryptedDekIvBase64}
          multiline
          minRows={2}
          maxRows={3}
          fullWidth
          slotProps={{ input: { readOnly: true } }}
        />
      </Box>
      <Typography
        variant="body2"
        color="text.secondary"
        sx={{ textAlign: 'center', px: { md: 0.5 } }}
      >
        +
      </Typography>
      <StepOutputTextField
        color="secondary"
        label="DEK (step 1, same for all)"
        value={dekBase64}
        multiline
        minRows={2}
        maxRows={4}
        fullWidth
        slotProps={{ input: { readOnly: true } }}
      />
      <Typography
        variant="body2"
        color="text.secondary"
        sx={{ textAlign: 'center', px: { md: 0.5 } }}
      >
        → AES-GCM →
      </Typography>
      <StepOutputTextField
        color="success"
        tooltipMessage="Included in payload"
        label={`Encrypted DEK (recipient ${recipientLabel})`}
        value={encryptedDekBase64}
        multiline
        minRows={2}
        maxRows={4}
        fullWidth
        slotProps={{ input: { readOnly: true } }}
      />
    </StepExampleGrid>
  );
}

const ENCRYPT_CONTENT_STEP_DESCRIPTION =
  'Generate a random symetric AES-256 DEK (Data Encryption Key) and encrypt the message with AES-GCM. The DEK will be used with KEK (Key Encryption Key) in step 5 to create Encrypted DEK which can be shared in JSON payload.';

const ECDHE_STEP_DESCRIPTION =
  'The app creates a one-time private/public key pair for this message only. Private key is not saved anywhere. After you send, only the matching public half is included in the manifest. For each recipient, that private key and their public key are combined to produce a shared secret. Only you, while encrypting, and that recipient later - using their private key plus public half from the manifest - can compute the same secret. The message is not encrypted with it directly. Later steps turn it into a key used to encrypt the small random message key into a package only that recipient can decrypt.';

const IMPORT_HKDF_MATERIAL_STEP_DESCRIPTION =
  'The ECDH shared secret from step 2 is not used directly as an encryption key. For each recipient, its raw bytes are imported into the Web Crypto API as HKDF key material—the input HKDF needs before it can derive a proper AES key in the next step. ECDH output is not guaranteed to be uniformly random, so we do not treat it as a finished KEK.';

const HKDF_STEP_DESCRIPTION =
  "For each recipient, HKDF expands the imported key material from step 3 with a random salt (nonce) and a fixed info string into a separate AES-256-GCM KEK (key encryption key). That KEK encrypts the DEK in step 5 into a package only that recipient can open. Your message body was encrypted in step 1 with the DEK. Each recipient's salt (nonce) is stored in the manifest so they can re-derive the same KEK.";

const ENCRYPT_DEK_STEP_DESCRIPTION =
  'For each recipient, the KEK from step 4 encrypts the same DEK from step 1 with AES-GCM. Each recipient gets their own IV (nonce) and encrypted DEK in the key manifest. Only recipient can decrypt that package after re-deriving their KEK and recover the DEK needed to decrypt the message from step 1.';

const MANIFEST_STEP_DESCRIPTION =
  'Combine everything a recipient needs to decrypt into one JSON object: your long-term public key, the ephemeral agreement public key from step 2, the encrypted message body from step 1 (ciphertext + message IV), and the per-recipient key manifest from step 5 (encrypted DEKs, KEK encryption IVs, and HKDF salts).';

const SIGN_MANIFEST_STEP_DESCRIPTION =
  'Sign the manifest body from step 6 with your long-term private key using ECDSA P-256 / SHA-256 (ES256). The top-level senderSignature covers version, wrap, sender keys, and encryptedContent (iv + ciphertext). keyManifest is not included in the signature. Recipients verify senderSignature against senderPublicJwk before decrypting.';

const EncryptStepsPanel = memo(function EncryptStepsPanel({
  steps,
  getPlaintextRef,
  onCopyPayload,
  copyState,
}: {
  steps: StepsPanelProps;
  getPlaintextRef: RefObject<() => string>;
  onCopyPayload: () => void;
  copyState: CopyState;
}) {
  return (
    <Box sx={{ display: 'flex', flexDirection: 'column', gap: 3 }}>
      <Box
        sx={{
          display: 'flex',
          flexWrap: 'wrap',
          alignItems: 'center',
          justifyContent: 'space-between',
          gap: 4,
        }}
      >
        <MockRecipientsChip />
        <Button
          variant="outlined"
          color="success"
          loading={steps.runAllBusy}
          onClick={steps.startRunAllSteps}
          disabled={!steps.canRunAllSteps}
          sx={{ width: 'fit-content' }}
        >
          Run all encryption steps (without signing)
        </Button>
      </Box>

      <Box sx={stepContentSx}>
        <StepActionRow
          content={
            <StepInfoAlert number={1} flow="encrypt">
              {ENCRYPT_CONTENT_STEP_DESCRIPTION}
            </StepInfoAlert>
          }
        >
          <Button
            variant="outlined"
            color="success"
            loading={steps.busyStep === 'aesContent'}
            onClick={steps.runGenerateDekAndEncrypt}
            disabled={steps.keysLoading || steps.busyStep !== null}
          >
            Encrypt message
          </Button>
        </StepActionRow>
        <EncryptContentExampleCaption
          example={steps.encryptContentExample}
          getPlaintextRef={getPlaintextRef}
        />
      </Box>

      <Box sx={stepContentSx}>
        <StepActionRow
          content={
            <StepInfoAlert number={2} flow="encrypt">
              {ECDHE_STEP_DESCRIPTION}
            </StepInfoAlert>
          }
        >
          <Button
            variant="outlined"
            color="success"
            loading={steps.busyStep === 'ecdhe'}
            onClick={steps.runEcdhe}
            disabled={
              steps.keysLoading || !steps.keysReady || steps.busyStep !== null
            }
          >
            Run ECDHE
          </Button>
        </StepActionRow>
        <EcdheSharedSecretExampleCaption
          example={steps.ecdheSharedSecretExample}
        />
        <StepOutputTextField
          color="success"
          tooltipMessage="Included in payload"
          label="Ephemeral agreement public key"
          value={steps.ecdheEphemeralPublicJwkOutput}
          multiline
          rows={6}
          fullWidth
          slotProps={{ input: { readOnly: true } }}
        />
        <StepOutputTextField
          label={encryptPerRecipientLinesLabel('Shared secrets')}
          value={steps.ecdheOutput}
          multiline
          rows={4}
          fullWidth
          slotProps={{ input: { readOnly: true } }}
        />
      </Box>

      <Box sx={stepContentSx}>
        <StepActionRow
          content={
            <StepInfoAlert number={3} flow="encrypt">
              {IMPORT_HKDF_MATERIAL_STEP_DESCRIPTION}
            </StepInfoAlert>
          }
        >
          <Button
            variant="outlined"
            color="success"
            loading={steps.busyStep === 'hkdfImport'}
            onClick={steps.runImportHkdfMaterial}
            disabled={
              steps.keysLoading ||
              !steps.canRunImportHkdfMaterial ||
              steps.busyStep !== null
            }
          >
            Import HKDF material
          </Button>
        </StepActionRow>
        <ImportHkdfMaterialExampleCaption
          example={steps.importHkdfMaterialExample}
        />
        <StepOutputTextField
          label={encryptPerRecipientLinesLabel(
            'HKDF material fingerprints (SHA-256 of ECDHE secret)',
          )}
          value={steps.hkdfMaterialOutput}
          multiline
          rows={4}
          fullWidth
          slotProps={{ input: { readOnly: true } }}
        />
      </Box>

      <Box sx={stepContentSx}>
        <StepActionRow
          content={
            <StepInfoAlert number={4} flow="encrypt">
              {HKDF_STEP_DESCRIPTION}
            </StepInfoAlert>
          }
        >
          <Button
            variant="outlined"
            color="success"
            loading={steps.busyStep === 'aesKek'}
            onClick={steps.runDeriveAesKeks}
            disabled={
              steps.keysLoading ||
              !steps.canRunDeriveKeks ||
              steps.busyStep !== null
            }
          >
            Derive KEKs
          </Button>
        </StepActionRow>
        <DeriveKekExampleCaption example={steps.deriveKekExample} />
        <StepOutputTextField
          label={encryptPerRecipientLinesLabel('HKDF salts')}
          value={steps.hkdfSaltOutput}
          multiline
          rows={4}
          fullWidth
          slotProps={{ input: { readOnly: true } }}
        />
        <StepOutputTextField
          label={encryptPerRecipientLinesLabel('AES-256 KEKs')}
          value={steps.aesKekOutput}
          multiline
          minRows={4}
          maxRows={4}
          fullWidth
          slotProps={{ input: { readOnly: true } }}
        />
      </Box>

      <Box sx={stepContentSx}>
        <StepActionRow
          content={
            <StepInfoAlert number={5} flow="encrypt">
              {ENCRYPT_DEK_STEP_DESCRIPTION}
            </StepInfoAlert>
          }
        >
          <Button
            variant="outlined"
            color="success"
            loading={steps.busyStep === 'encryptDek'}
            onClick={steps.runEncryptDekPerRecipient}
            disabled={
              steps.keysLoading ||
              !steps.hasKeksDone ||
              !steps.hasEncryptedContentDone ||
              steps.busyStep !== null
            }
          >
            Encrypt DEK per recipient
          </Button>
        </StepActionRow>
        <EncryptDekExampleCaption example={steps.encryptDekExample} />
        <StepOutputTextField
          label={encryptPerRecipientLinesLabel(
            'KEK encryption IVs (nonce) (Base64)',
          )}
          value={steps.encryptedDekIvOutput}
          multiline
          rows={4}
          fullWidth
          slotProps={{ input: { readOnly: true } }}
        />
        <StepOutputTextField
          label={encryptPerRecipientLinesLabel('Encrypted DEK (Base64)')}
          value={steps.encryptedDekOutput}
          multiline
          rows={4}
          fullWidth
          slotProps={{ input: { readOnly: true } }}
        />
      </Box>

      <Box sx={stepContentSx}>
        <StepActionRow
          content={
            <StepInfoAlert number={6} flow="encrypt">
              {MANIFEST_STEP_DESCRIPTION}
            </StepInfoAlert>
          }
        >
          <Button
            variant="outlined"
            color="success"
            loading={steps.busyStep === 'manifest'}
            onClick={steps.runBuildManifest}
            disabled={
              steps.keysLoading ||
              !steps.hasEncryptedDekDone ||
              steps.busyStep !== null
            }
          >
            Assemble JSON payload
          </Button>
        </StepActionRow>

        {steps.error && steps.busyStep !== 'signManifest' && (
          <Typography color="error" variant="body2">
            {steps.error}
          </Typography>
        )}

        <StepOutputTextField
          color="success"
          tooltipMessage="Manifest assembly — sign in step 7. keyManifest shows the first recipient only. Copy uses the full payload."
          label="Manifest assembly JSON"
          value={steps.assemblyOutput}
          multiline
          minRows={8}
          maxRows={12}
          fullWidth
          slotProps={{ input: { readOnly: true } }}
        />
      </Box>

      <Box sx={stepContentSx}>
        <StepActionRow
          content={
            <StepInfoAlert number={7} flow="encrypt">
              {SIGN_MANIFEST_STEP_DESCRIPTION}
            </StepInfoAlert>
          }
        >
          <Button
            variant="outlined"
            color="success"
            loading={steps.busyStep === 'signManifest'}
            onClick={steps.runSignManifest}
            disabled={
              steps.keysLoading ||
              !steps.hasAssemblyDone ||
              steps.busyStep !== null
            }
          >
            Sign manifest
          </Button>
        </StepActionRow>

        {steps.error && steps.busyStep === 'signManifest' && (
          <Typography color="error" variant="body2">
            {steps.error}
          </Typography>
        )}

        <StepOutputTextField
          color="success"
          tooltipMessage="Included in final payload"
          label="senderSignature (Base64, ES256)"
          value={steps.senderSignatureOutput}
          multiline
          rows={3}
          fullWidth
          slotProps={{ input: { readOnly: true } }}
        />

        <StepOutputTextField
          label="Signed payload JSON (manifest body + senderSignature)"
          value={steps.aesOutput}
          multiline
          minRows={8}
          maxRows={12}
          fullWidth
          slotProps={{ input: { readOnly: true } }}
        />
        <Box
          sx={{
            display: 'flex',
            flexWrap: 'wrap',
            gap: 1,
            alignItems: 'center',
            justifyContent: 'space-between',
          }}
        >
          <Button
            variant="outlined"
            onClick={onCopyPayload}
            disabled={!steps.signedPayloadJson}
          >
            {copyState === 'ok'
              ? 'Copied'
              : copyState === 'err'
                ? 'Copy failed'
                : 'Copy JSON payload'}
          </Button>
        </Box>
      </Box>
    </Box>
  );
});

export function EncryptMessageStepByStep({
  onOutputChange,
}: EncryptMessageStepByStepProps) {
  const [copyState, setCopyState] = useState<CopyState>('idle');
  const getPlaintextRef = useRef<() => string>(() => '');
  const steps = useEncryptManifestSteps(getPlaintextRef);
  const { signedPayloadJson } = steps;

  useEffect(() => {
    onOutputChange?.(signedPayloadJson);
  }, [signedPayloadJson, onOutputChange]);

  const handleCopyPayload = useCallback(async () => {
    if (!signedPayloadJson) return;
    try {
      await navigator.clipboard.writeText(signedPayloadJson);
      setCopyState('ok');
    } catch {
      setCopyState('err');
    }
    window.setTimeout(() => setCopyState('idle'), 2000);
  }, [signedPayloadJson]);

  if (steps.keysLoading) {
    return (
      <Box sx={{ display: 'flex', alignItems: 'center', gap: 2, py: 2 }}>
        <CircularProgress size={24} />
        <Typography variant="body2" color="text.secondary">
          Loading keys…
        </Typography>
      </Box>
    );
  }

  return (
    <EncryptStepsPanel
      steps={steps}
      getPlaintextRef={getPlaintextRef}
      onCopyPayload={handleCopyPayload}
      copyState={copyState}
    />
  );
}
