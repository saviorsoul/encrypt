import React, { memo, useCallback, useState } from 'react';
import Box from '@mui/material/Box';
import Button from '@mui/material/Button';
import CircularProgress from '@mui/material/CircularProgress';
import Link from '@mui/material/Link';
import Typography from '@mui/material/Typography';
import { Link as RouterLink } from 'react-router-dom';
import {
  manifestStepHref,
  stepContentSx,
} from '@/components/manifest-steps/stepLayout.ts';
import { StepActionRow } from '@/components/manifest-steps/StepActionRow.tsx';
import { StepInfoAlert } from '@/components/manifest-steps/StepInfoAlert.tsx';
import { StepExampleGrid } from '@/components/manifest-steps/StepExampleGrid.tsx';
import { StepOutputTextField } from '@/components/manifest-steps/StepOutputTextField.tsx';
import { MOCK_EXTERNAL_RECIPIENT_COUNT } from '@/components/providers/MockExternalRecipientProvider.tsx';
import { MockRecipientsChip } from '@/components/encrypt/MockRecipientsChip.tsx';
import type { DemoParentFeedMessage } from '@/crypto/demoFeedCommentPoC.ts';
import {
  useShareFeedMessageSteps,
  type ShareDeriveKekExample,
  type ShareEcdheSharedSecretExample,
  type ShareImportHkdfMaterialExample,
  type ShareRewrapDekExample,
} from '@/hooks/useShareFeedMessageSteps.ts';
import type { CopyState } from '@/types/copyState.ts';
import { copyTextToClipboard } from '@/utils/copyToClipboard.ts';
import { stringifyManifestPayloadForDisplay } from '@/utils/formatManifestJsonForDisplay.ts';

export const SHARE_CRYPTO_OVERVIEW =
  'Sharing re-wraps the parent message DEK for new recipients under a fresh ephemeral ECDHE key pair. The signed share references the parent post by parentMessageId (signed, like comments) - not by embedding the full parent payload. Recipients must already have the parent message in their feed.';

const DERIVE_DEK_STEP_DESCRIPTION = (
  <>
    Recover the parent message DEK using Decrypt{' '}
    <Link component={RouterLink} to={manifestStepHref('decrypt', 1)}>
      step 1
    </Link>{' '}
    through{' '}
    <Link component={RouterLink} to={manifestStepHref('decrypt', 6)}>
      step 6
    </Link>{' '}
    with your keyManifest entry on the parent post. The parent signature is
    verified before unwrapping. The message ciphertext is not decrypted - only
    the DEK is recovered for re-wrapping.
  </>
);

const ECDHE_STEP_DESCRIPTION = (
  <>
    Generate a fresh ephemeral ECDHE key pair for this share delivery (same as
    Encrypt{' '}
    <Link component={RouterLink} to={manifestStepHref('encrypt', 2)}>
      step 2
    </Link>
    ). Derive shared secrets with each new recipient plus yourself as sharer.
    The ephemeral private key is discarded after the wrap completes.
  </>
);

const IMPORT_HKDF_MATERIAL_STEP_DESCRIPTION =
  'Step 2 gives each recipient a shared secret, but that secret cannot lock anything by itself. Here, the app keeps it ready for the next step, which will turn it into a real encryption key. Think of it as an unfinished key: step 4 adds a random salt and shapes it into the proper KEK (Key Encryption Key) each recipient needs.';

const HKDF_STEP_DESCRIPTION =
  'For each recipient, the app finishes the unfinished secret from step 3 and turns it into a real encryption key - the KEK (Key Encryption Key). Recipients already started with different shared secrets in step 2, so each one gets their own KEK. A random salt is also mixed in and saved in the payload so the recipient can rebuild that exact key later. In step 5, that KEK locks the DEK into a package only recipients can open.';

const ENCRYPT_DEK_STEP_DESCRIPTION =
  'For each recipient, the KEK from step 4 locks the DEK from step 1 into a package only recipient can open. Everyone shares the same message key, but each person gets their own locked copy saved in the payload. When they decrypt that package later, they recover the DEK and can read the message from step 1.';

const ASSEMBLE_SHARE_STEP_DESCRIPTION =
  'Build the share signable body. The key manifest is stored separately and is not signed.';

const SIGN_SHARE_STEP_DESCRIPTION =
  'Sign the canonical JSON of the share signable body (including parentMessageId) with your long-term ECDSA P-256 private key. Recipients verify sharerSignature before unwrapping their shard. The parent post must already be in the recipient feed.';

function sharePerRecipientLinesLabel(description: string): string {
  const last = String(MOCK_EXTERNAL_RECIPIENT_COUNT).padStart(3, '0');
  return `${description}, recipients 001–${last} + sharer`;
}

type ParentFeedMessagePanelProps = {
  demo: DemoParentFeedMessage;
};

function ParentFeedMessagePanel({ demo }: ParentFeedMessagePanelProps) {
  const payloadDisplay = stringifyManifestPayloadForDisplay(
    JSON.parse(demo.parentPayload),
  );

  return (
    <Box sx={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
      <StepOutputTextField
        label="Message ID"
        value={demo.parentMessageId}
        fullWidth
        slotProps={{ input: { readOnly: true } }}
      />
      <StepOutputTextField
        label="Generated mocked feed message"
        value={payloadDisplay}
        multiline
        minRows={8}
        maxRows={12}
        fullWidth
        slotProps={{ input: { readOnly: true } }}
      />
    </Box>
  );
}

function EcdheSharedSecretExampleCaption({
  example,
}: {
  example: ShareEcdheSharedSecretExample | null;
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
  example: ShareImportHkdfMaterialExample | null;
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
  example: ShareDeriveKekExample | null;
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

function RewrapDekExampleCaption({
  example,
}: {
  example: ShareRewrapDekExample | null;
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

type ShareStepsPanelProps = ReturnType<typeof useShareFeedMessageSteps>;

const ShareStepsPanel = memo(function ShareStepsPanel({
  steps,
  onCopyExport,
  copyState,
}: {
  steps: ShareStepsPanelProps;
  onCopyExport: () => void;
  copyState: CopyState;
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
          color="text.success"
          sx={{
            textTransform: 'uppercase',
            flexShrink: 0,
            pr: 4,
            minWidth: 0,
            borderLeft: '4px solid',
            borderColor: 'success.main',
            pl: 2,
          }}
        >
          Share message
        </Typography>
        <MockRecipientsChip />
      </Box>

      <Box sx={stepContentSx}>
        <StepActionRow
          content={
            <StepInfoAlert number={1} flow="encrypt">
              {DERIVE_DEK_STEP_DESCRIPTION}
            </StepInfoAlert>
          }
        >
          <Button
            variant="outlined"
            color="success"
            loading={steps.busyStep === 'deriveDek'}
            onClick={steps.runDeriveDek}
            disabled={
              !steps.demoReady || !steps.keysReady || steps.busyStep !== null
            }
          >
            Derive DEK
          </Button>
        </StepActionRow>
        {steps.error && steps.errorStep === 'deriveDek' && (
          <Typography color="error" variant="body2">
            {steps.error}
          </Typography>
        )}
        <StepOutputTextField
          color="secondary"
          tooltipMessage="Same raw DEK that encrypted the parent message  -  re-wrapped for new recipients"
          label="DEK"
          value={steps.dekOutput}
          multiline
          minRows={2}
          maxRows={4}
          fullWidth
          slotProps={{ input: { readOnly: true } }}
        />
        {steps.parentVerified && (
          <Typography variant="caption" color="success.main">
            Parent manifest signature verified.
          </Typography>
        )}
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
            disabled={!steps.canRunEcdhe || steps.busyStep !== null}
          >
            ECDHE
          </Button>
        </StepActionRow>
        {steps.error && steps.errorStep === 'ecdhe' && (
          <Typography color="error" variant="body2">
            {steps.error}
          </Typography>
        )}
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
          label={sharePerRecipientLinesLabel('Shared secrets')}
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
              !steps.canRunImportHkdfMaterial || steps.busyStep !== null
            }
          >
            Import HKDF material
          </Button>
        </StepActionRow>
        {steps.error && steps.errorStep === 'hkdfImport' && (
          <Typography color="error" variant="body2">
            {steps.error}
          </Typography>
        )}
        <ImportHkdfMaterialExampleCaption
          example={steps.importHkdfMaterialExample}
        />
        <StepOutputTextField
          label={sharePerRecipientLinesLabel(
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
            loading={steps.busyStep === 'deriveKek'}
            onClick={steps.runDeriveKeks}
            disabled={!steps.canRunDeriveKek || steps.busyStep !== null}
          >
            Derive KEKs
          </Button>
        </StepActionRow>
        {steps.error && steps.errorStep === 'deriveKek' && (
          <Typography color="error" variant="body2">
            {steps.error}
          </Typography>
        )}
        <DeriveKekExampleCaption example={steps.deriveKekExample} />
        <StepOutputTextField
          label={sharePerRecipientLinesLabel('HKDF salts')}
          value={steps.hkdfSaltOutput}
          multiline
          rows={4}
          fullWidth
          slotProps={{ input: { readOnly: true } }}
        />
        <StepOutputTextField
          label={sharePerRecipientLinesLabel('AES-256 KEKs')}
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
            loading={steps.busyStep === 'rewrapDek'}
            onClick={steps.runRewrapDek}
            disabled={!steps.canRunRewrapDek || steps.busyStep !== null}
          >
            Encrypt DEK per recipient
          </Button>
        </StepActionRow>
        {steps.error && steps.errorStep === 'rewrapDek' && (
          <Typography color="error" variant="body2">
            {steps.error}
          </Typography>
        )}
        <RewrapDekExampleCaption example={steps.rewrapDekExample} />
        <StepOutputTextField
          label={sharePerRecipientLinesLabel(
            'KEK encryption IVs (nonce) (Base64)',
          )}
          value={steps.encryptedDekIvOutput}
          multiline
          rows={4}
          fullWidth
          slotProps={{ input: { readOnly: true } }}
        />
        <StepOutputTextField
          label={sharePerRecipientLinesLabel('Encrypted DEK (Base64)')}
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
              {ASSEMBLE_SHARE_STEP_DESCRIPTION}
            </StepInfoAlert>
          }
        >
          <Button
            variant="outlined"
            color="success"
            loading={steps.busyStep === 'assemble'}
            onClick={steps.runAssembleShare}
            disabled={
              !steps.keysReady ||
              !steps.canRunAssemble ||
              steps.busyStep !== null
            }
          >
            Assemble signable body
          </Button>
        </StepActionRow>
        {steps.error && steps.errorStep === 'assemble' && (
          <Typography color="error" variant="body2">
            {steps.error}
          </Typography>
        )}
        <StepOutputTextField
          label="Share signable body JSON"
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
              {SIGN_SHARE_STEP_DESCRIPTION}
            </StepInfoAlert>
          }
        >
          <Button
            variant="outlined"
            color="success"
            loading={steps.busyStep === 'sign'}
            onClick={steps.runSignShare}
            disabled={
              !steps.keysReady ||
              !steps.hasAssemblyDone ||
              steps.busyStep !== null
            }
          >
            Sign share
          </Button>
        </StepActionRow>
        {steps.error && steps.errorStep === 'sign' && (
          <Typography color="error" variant="body2">
            {steps.error}
          </Typography>
        )}
        <StepOutputTextField
          color="success"
          tooltipMessage="Included in payload"
          label="Sharer signature (Base64, ES256)"
          value={steps.sharerSignatureOutput}
          multiline
          rows={3}
          fullWidth
          slotProps={{ input: { readOnly: true } }}
        />
        <StepOutputTextField
          label="Export JSON (share + key manifest)"
          value={steps.exportPayloadDisplay}
          multiline
          minRows={10}
          maxRows={16}
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
            onClick={onCopyExport}
            disabled={!steps.exportPayloadJson}
          >
            {copyState === 'ok'
              ? 'Copied'
              : copyState === 'err'
                ? 'Copy failed'
                : 'Copy export JSON'}
          </Button>
        </Box>
      </Box>
    </Box>
  );
});

type ShareFeedMessageStepByStepProps = {
  demo: DemoParentFeedMessage | null;
  demoLoading?: boolean;
  demoError?: string | null;
};

export function ShareFeedMessageStepByStep({
  demo,
  demoLoading = false,
  demoError = null,
}: ShareFeedMessageStepByStepProps) {
  const [copyState, setCopyState] = useState<CopyState>('idle');
  const steps = useShareFeedMessageSteps(demo);

  const handleCopyExport = useCallback(async () => {
    if (!steps.exportPayloadJson) return;
    try {
      await copyTextToClipboard(steps.exportPayloadJson);
      setCopyState('ok');
    } catch {
      setCopyState('err');
    }
    window.setTimeout(() => setCopyState('idle'), 2000);
  }, [steps.exportPayloadJson]);

  if (demoLoading || steps.keysLoading) {
    return (
      <Box sx={{ display: 'flex', alignItems: 'center', gap: 2, py: 2 }}>
        <CircularProgress size={24} />
        <Typography variant="body2" color="text.secondary">
          Preparing demo feed post…
        </Typography>
      </Box>
    );
  }

  if (demoError) {
    return (
      <Typography color="error" variant="body2">
        {demoError}
      </Typography>
    );
  }

  if (!demo) {
    return null;
  }

  return (
    <Box sx={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
      <ParentFeedMessagePanel demo={demo} />
      <ShareStepsPanel
        steps={steps}
        onCopyExport={handleCopyExport}
        copyState={copyState}
      />
    </Box>
  );
}
