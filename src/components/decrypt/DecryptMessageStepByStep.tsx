import React, { memo } from 'react';
import Box from '@mui/material/Box';
import Button from '@mui/material/Button';
import Typography from '@mui/material/Typography';
import CircularProgress from '@mui/material/CircularProgress';
import { stepContentSx } from '@/components/manifest-steps/stepLayout.ts';
import { StepActionRow } from '@/components/manifest-steps/StepActionRow.tsx';
import { StepInfoAlert } from '@/components/manifest-steps/StepInfoAlert.tsx';
import { StepExampleGrid } from '@/components/manifest-steps/StepExampleGrid.tsx';
import { StepOutputTextField } from '@/components/manifest-steps/StepOutputTextField.tsx';
import {
  useDecryptManifestSteps,
  type DecryptContentExample,
  type DecryptDeriveKekExample,
  type DecryptEcdheSharedSecretExample,
  type DecryptImportHkdfMaterialExample,
  type DecryptDekExample,
  type DecryptVerifyExample,
} from '@/hooks/useDecryptManifestSteps.ts';

type DecryptMessageStepByStepProps = {
  encryptedPayload: string;
};

const VERIFY_STEP_DESCRIPTION =
  'Parse the signed JSON payload and verify senderSignature with senderPublicJwk using ECDSA P-256 / SHA-256 (ES256). Recipients should confirm the manifest was produced by the claimed sender and was not tampered with after signing before recovering keys or decrypting the message.';

const EXTRACT_STEP_DESCRIPTION =
  'After signature verification, read the fields needed for decryption: ephemeralPublicKey from step 2 of encryption, encryptedContent (message IV and ciphertext), and the keyManifest entry for mock recipient 001 (Encrypted DEK, KEK encryption IV, HKDF salt).';

const ECDHE_STEP_DESCRIPTION =
  'Combine the mock recipient 001 ECDH private key with ephemeralPublicKey from the manifest to reproduce the same ECDH shared secret the sender derived with their one-time agreement private key and that recipient’s public key. Only that shared secret feeds the HKDF steps that recover the KEK.';

const IMPORT_HKDF_MATERIAL_STEP_DESCRIPTION =
  'Import the ECDH shared secret as HKDF key material—the same Web Crypto step the sender ran before HKDF expand. The fingerprint shown is SHA-256 of the shared secret bytes; the HKDF key object itself cannot be exported as raw bytes from the browser.';

const HKDF_STEP_DESCRIPTION =
  'HKDF expand uses the imported material, the salt from your key manifest entry, and the fixed info string to re-derive the AES-256-GCM KEK the sender used to encrypt the DEK.';

const DECRYPT_DEK_STEP_DESCRIPTION =
  'Use the KEK to AES-GCM-decrypt encryptedDek with the KEK encryption IV from your manifest entry. That yields the raw DEK—the same random AES key that encrypted the message body.';

const DECRYPT_CONTENT_STEP_DESCRIPTION =
  'Decrypt encryptedContent with the recovered DEK and message IV using AES-GCM. The result is the original UTF-8 message plaintext.';

function VerifySignatureExampleCaption({
  example,
}: {
  example: DecryptVerifyExample | null;
}) {
  return (
    <Box sx={{ display: 'flex', flexDirection: 'column', gap: 1 }}>
      <StepOutputTextField
        color="success"
        tooltipMessage="From payload — used to verify signature"
        label="senderPublicJwk"
        value={example?.senderPublicJwk ?? ''}
        multiline
        rows={6}
        fullWidth
        slotProps={{ input: { readOnly: true } }}
      />
      <StepOutputTextField
        color="success"
        tooltipMessage="ES256 signature over unsigned manifest body"
        label="senderSignature (Base64)"
        value={example?.senderSignature ?? ''}
        multiline
        rows={3}
        fullWidth
        slotProps={{ input: { readOnly: true } }}
      />
      {example?.signatureValid && (
        <Typography variant="body2" color="success.main">
          Signature valid
        </Typography>
      )}
    </Box>
  );
}

function DecryptEcdheSharedSecretExampleCaption({
  example,
}: {
  example: DecryptEcdheSharedSecretExample | null;
}) {
  return (
    <StepExampleGrid>
      <StepOutputTextField
        tooltipMessage="Mock recipient 001 ECDH private key (demo only)"
        label="Mock recipient 001 private key (ECDH)"
        value={example?.recipientPrivateJwk ?? ''}
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
        tooltipMessage="From manifest (sender step 2)"
        label="Ephemeral agreement public key"
        value={example?.ephemeralPublicKey ?? ''}
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
        label="Shared secret"
        value={example?.sharedSecretBase64 ?? ''}
        multiline
        minRows={2}
        maxRows={4}
        fullWidth
        slotProps={{ input: { readOnly: true } }}
      />
    </StepExampleGrid>
  );
}

function DecryptImportHkdfMaterialExampleCaption({
  example,
}: {
  example: DecryptImportHkdfMaterialExample | null;
}) {
  return (
    <StepExampleGrid columns={3}>
      <StepOutputTextField
        color="error"
        label="Shared secret (step 3)"
        value={example?.sharedSecretBase64 ?? ''}
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
        label="HKDF key material (SHA-256 fingerprint of shared secret)"
        value={example?.hkdfMaterialFingerprintBase64 ?? ''}
        multiline
        minRows={2}
        maxRows={4}
        fullWidth
        slotProps={{ input: { readOnly: true } }}
      />
    </StepExampleGrid>
  );
}

function DecryptDeriveKekExampleCaption({
  example,
}: {
  example: DecryptDeriveKekExample | null;
}) {
  return (
    <StepExampleGrid>
      <StepOutputTextField
        label="HKDF material (step 4, SHA-256 of ECDHE secret)"
        value={example?.hkdfMaterialFingerprintBase64 ?? ''}
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
        +
      </Typography>
      <StepOutputTextField
        color="success"
        tooltipMessage="From your key manifest entry (sender step 4)"
        label="HKDF salt (from manifest)"
        value={example?.hkdfSaltBase64 ?? ''}
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
        label="AES-256 KEK"
        value={example?.kekBase64 ?? ''}
        multiline
        minRows={2}
        maxRows={4}
        fullWidth
        slotProps={{ input: { readOnly: true } }}
      />
    </StepExampleGrid>
  );
}

function DecryptDekExampleCaption({
  example,
}: {
  example: DecryptDekExample | null;
}) {
  return (
    <StepExampleGrid>
      <Box sx={{ display: 'flex', flexDirection: 'column', gap: 1 }}>
        <StepOutputTextField
          label="KEK (step 5)"
          value={example?.kekBase64 ?? ''}
          multiline
          minRows={2}
          maxRows={4}
          fullWidth
          slotProps={{ input: { readOnly: true } }}
        />
        <StepOutputTextField
          color="success"
          label="KEK encryption IV (from manifest)"
          value={example?.encryptedDekIvBase64 ?? ''}
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
        +
      </Typography>
      <StepOutputTextField
        color="success"
        label="Encrypted DEK (Base64)"
        value={example?.encryptedDekBase64 ?? ''}
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
        color="secondary"
        label="DEK"
        value={example?.dekBase64 ?? ''}
        multiline
        minRows={2}
        maxRows={4}
        fullWidth
        slotProps={{ input: { readOnly: true } }}
      />
    </StepExampleGrid>
  );
}

function DecryptContentExampleCaption({
  example,
}: {
  example: DecryptContentExample | null;
}) {
  const dekBase64 = example?.dekBase64 ?? '';
  const contentIvBase64 = example?.contentIvBase64 ?? '';
  const ciphertextBase64 = example?.ciphertextBase64 ?? '';
  const plaintext = example?.plaintextMessage ?? '';

  return (
    <StepExampleGrid>
      <Box sx={{ display: 'flex', flexDirection: 'column', gap: 1 }}>
        <StepOutputTextField
          color="secondary"
          label="DEK (step 6)"
          value={dekBase64}
          multiline
          minRows={2}
          maxRows={4}
          fullWidth
          slotProps={{ input: { readOnly: true } }}
        />
        <StepOutputTextField
          color="success"
          label="Content IV (from manifest)"
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
        +
      </Typography>
      <StepOutputTextField
        color="success"
        label="Content ciphertext (from manifest)"
        value={ciphertextBase64}
        multiline
        rows={4}
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
        label="Decrypted plaintext message"
        value={plaintext}
        multiline
        rows={4}
        fullWidth
        slotProps={{ input: { readOnly: true } }}
      />
    </StepExampleGrid>
  );
}

const DecryptStepsPanel = memo(function DecryptStepsPanel({
  steps,
}: {
  steps: ReturnType<typeof useDecryptManifestSteps>;
}) {
  return (
    <Box sx={{ display: 'flex', flexDirection: 'column', gap: 3 }}>
      <Box
        sx={{
          display: 'flex',
          flexDirection: 'row',
          flexWrap: 'wrap',
          alignItems: 'center',
          justifyContent: 'space-between',
          gap: 2,
          width: '100%',
        }}
      >
        <Typography
          variant="h4"
          color="text.info"
          sx={{
            textTransform: 'uppercase',
            flexShrink: 0,
            pr: 4,
            minWidth: 0,
            borderLeft: '4px solid',
            borderColor: 'info.main',
            pl: 2,
          }}
        >
          Decrypt
        </Typography>

        <Box
          sx={{
            display: 'inline-flex',
            flexDirection: 'column',
            gap: 2,
            minWidth: 0,
            flexShrink: 1,
          }}
        >
          <Button
            variant="outlined"
            color="info"
            loading={steps.runAllBusy}
            onClick={steps.startRunAllSteps}
            disabled={!steps.canRunAllSteps}
            sx={{ width: 'fit-content', minWidth: 200 }}
          >
            Run all decryption steps
          </Button>
        </Box>
      </Box>

      <Box sx={stepContentSx}>
        <StepActionRow
          content={
            <StepInfoAlert number={1} flow="decrypt">
              {VERIFY_STEP_DESCRIPTION}
            </StepInfoAlert>
          }
        >
          <Button
            variant="outlined"
            color="info"
            loading={steps.busyStep === 'verify'}
            onClick={steps.runVerifySignature}
            disabled={
              steps.keysLoading ||
              !steps.payloadReady ||
              steps.busyStep !== null
            }
          >
            Verify signature
          </Button>
        </StepActionRow>
        <VerifySignatureExampleCaption example={steps.verifyExample} />
      </Box>

      <Box sx={stepContentSx}>
        <StepActionRow
          content={
            <StepInfoAlert number={2} flow="decrypt">
              {EXTRACT_STEP_DESCRIPTION}
            </StepInfoAlert>
          }
        >
          <Button
            variant="outlined"
            color="info"
            loading={steps.busyStep === 'extract'}
            onClick={steps.runExtractManifestFields}
            disabled={
              steps.keysLoading ||
              !steps.decryptMockKeysReady ||
              !steps.hasVerifiedSignature ||
              steps.busyStep !== null
            }
          >
            Extract fields
          </Button>
        </StepActionRow>
        <StepOutputTextField
          color="success"
          label="Ephemeral agreement public key"
          value={steps.ephemeralPublicKeyOutput}
          multiline
          rows={6}
          fullWidth
          slotProps={{ input: { readOnly: true } }}
        />
        <StepOutputTextField
          color="success"
          label="Content IV (nonce)"
          value={steps.contentIvOutput}
          multiline
          rows={1}
          fullWidth
          slotProps={{ input: { readOnly: true } }}
        />
        <StepOutputTextField
          color="success"
          label="Content ciphertext"
          value={steps.contentCiphertextOutput}
          multiline
          rows={4}
          fullWidth
          slotProps={{ input: { readOnly: true } }}
        />
        <StepOutputTextField
          color="success"
          label="Key manifest entry (mock recipient 001 recipientKeyId)"
          value={steps.keyManifestEntryOutput}
          multiline
          minRows={4}
          maxRows={8}
          fullWidth
          slotProps={{ input: { readOnly: true } }}
        />
      </Box>

      <Box sx={stepContentSx}>
        <StepActionRow
          content={
            <StepInfoAlert number={3} flow="decrypt">
              {ECDHE_STEP_DESCRIPTION}
            </StepInfoAlert>
          }
        >
          <Button
            variant="outlined"
            color="info"
            loading={steps.busyStep === 'ecdhe'}
            onClick={steps.runEcdhe}
            disabled={
              steps.keysLoading ||
              !steps.decryptMockKeysReady ||
              !steps.hasExtractedFields ||
              steps.busyStep !== null
            }
          >
            Run ECDH
          </Button>
        </StepActionRow>
        <DecryptEcdheSharedSecretExampleCaption
          example={steps.ecdheSharedSecretExample}
        />
      </Box>

      <Box sx={stepContentSx}>
        <StepActionRow
          content={
            <StepInfoAlert number={4} flow="decrypt">
              {IMPORT_HKDF_MATERIAL_STEP_DESCRIPTION}
            </StepInfoAlert>
          }
        >
          <Button
            variant="outlined"
            color="info"
            loading={steps.busyStep === 'hkdfImport'}
            onClick={steps.runImportHkdfMaterial}
            disabled={
              steps.keysLoading ||
              !steps.hasEcdheDone ||
              steps.busyStep !== null
            }
          >
            Import HKDF material
          </Button>
        </StepActionRow>
        <DecryptImportHkdfMaterialExampleCaption
          example={steps.importHkdfMaterialExample}
        />
      </Box>

      <Box sx={stepContentSx}>
        <StepActionRow
          content={
            <StepInfoAlert number={5} flow="decrypt">
              {HKDF_STEP_DESCRIPTION}
            </StepInfoAlert>
          }
        >
          <Button
            variant="outlined"
            color="info"
            loading={steps.busyStep === 'aesKek'}
            onClick={steps.runDeriveKek}
            disabled={
              steps.keysLoading ||
              !steps.hasHkdfMaterialDone ||
              steps.busyStep !== null
            }
          >
            Derive KEK
          </Button>
        </StepActionRow>
        <DecryptDeriveKekExampleCaption example={steps.deriveKekExample} />
      </Box>

      <Box sx={stepContentSx}>
        <StepActionRow
          content={
            <StepInfoAlert number={6} flow="decrypt">
              {DECRYPT_DEK_STEP_DESCRIPTION}
            </StepInfoAlert>
          }
        >
          <Button
            variant="contained"
            color="info"
            loading={steps.busyStep === 'decryptDek'}
            onClick={steps.runDecryptDek}
            disabled={
              steps.keysLoading || !steps.hasKekDone || steps.busyStep !== null
            }
          >
            Decrypt DEK
          </Button>
        </StepActionRow>
        <DecryptDekExampleCaption example={steps.decryptDekExample} />
      </Box>

      <Box sx={stepContentSx}>
        <StepActionRow
          content={
            <StepInfoAlert number={7} flow="decrypt">
              {DECRYPT_CONTENT_STEP_DESCRIPTION}
            </StepInfoAlert>
          }
        >
          <Button
            variant="outlined"
            color="info"
            loading={steps.busyStep === 'decrypt'}
            onClick={steps.runDecryptContent}
            disabled={
              steps.keysLoading ||
              !steps.hasDecryptedDek ||
              steps.busyStep !== null
            }
          >
            Decrypt message
          </Button>
        </StepActionRow>
        <DecryptContentExampleCaption example={steps.decryptContentExample} />
      </Box>

      {steps.error && (
        <Typography color="error" variant="body2">
          {steps.error}
        </Typography>
      )}
    </Box>
  );
});

export function DecryptMessageStepByStep({
  encryptedPayload,
}: DecryptMessageStepByStepProps) {
  const steps = useDecryptManifestSteps(encryptedPayload);

  if (steps.keysLoading) {
    return (
      <Box sx={{ display: 'flex', alignItems: 'center', gap: 2, py: 2 }}>
        <CircularProgress size={24} />
        <Typography variant="body2" color="text.secondary">
          Loading mock recipient…
        </Typography>
      </Box>
    );
  }

  return <DecryptStepsPanel steps={steps} />;
}
