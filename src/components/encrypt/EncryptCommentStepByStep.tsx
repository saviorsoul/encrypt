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
import type { DemoParentFeedMessage } from '@/crypto/demoFeedCommentPoC.ts';
import {
  useEncryptCommentSteps,
  type DeriveCommentKeyExample,
  type EncryptCommentBodyExample,
  type ImportCommentHkdfMaterialExample,
} from '@/hooks/useEncryptCommentSteps.ts';
import type { CopyState } from '@/types/copyState.ts';
import { copyTextToClipboard } from '@/utils/copyToClipboard.ts';
import { stringifyManifestPayloadForDisplay } from '@/utils/formatManifestJsonForDisplay.ts';

export const COMMENT_CRYPTO_OVERVIEW =
  'A feed comment is encrypted under the same message DEK as its parent post—not under per-recipient KEKs. Anyone who can decrypt the post can decrypt its comments after verifying the author signature. The author uses their private key and their keyManifest entry on the parent feed manifest to recover that DEK before encrypting.';

const DERIVE_DEK_STEP_DESCRIPTION = (
  <>
    Recover the parent message DEK using Decrypt{' '}
    <Link component={RouterLink} to={manifestStepHref('decrypt', 1)}>
      step 1
    </Link>{' '}
    (verify signature),{' '}
    <Link component={RouterLink} to={manifestStepHref('decrypt', 2)}>
      step 2
    </Link>{' '}
    (extract fields),{' '}
    <Link component={RouterLink} to={manifestStepHref('decrypt', 3)}>
      step 3
    </Link>{' '}
    (ECDHE),{' '}
    <Link component={RouterLink} to={manifestStepHref('decrypt', 4)}>
      step 4
    </Link>{' '}
    (import HKDF material),{' '}
    <Link component={RouterLink} to={manifestStepHref('decrypt', 5)}>
      step 5
    </Link>{' '}
    (derive KEK), and{' '}
    <Link component={RouterLink} to={manifestStepHref('decrypt', 6)}>
      step 6
    </Link>{' '}
    (decrypt DEK), with your keyManifest entry on the parent manifest. Skip{' '}
    <Link component={RouterLink} to={manifestStepHref('decrypt', 7)}>
      step 7
    </Link>{' '}
    (decrypt message body). Comments never re-wrap the DEK for other recipients.
  </>
);

const IMPORT_HKDF_MATERIAL_STEP_DESCRIPTION =
  'Step 1 already recovered the raw message DEK - your per-recipient KEK was used only to unwrap it and is not used again. Import the DEK bytes as HKDF key material for a separate comment-specific derivation (not another KEK and not a DEK re-wrap). The fingerprint is SHA-256 of the DEK bytes.';

const DERIVE_COMMENT_KEY_STEP_DESCRIPTION = (
  <>
    With a fresh random salt, HKDF-expand to an AES-256-GCM comment key. This
    key encrypts the comment body only—the DEK stays unchanged and is never
    re-wrapped for other recipients. The salt on the wire lets anyone with the
    DEK re-derive the same comment key.
  </>
);

const ENCRYPT_COMMENT_BODY_STEP_DESCRIPTION =
  'AES-GCM-encrypt the comment plaintext with the comment key from step 3. The IV and ciphertext become encryptedContent on the wire—the comment key itself is not stored; recipients re-derive it from the DEK and salt.';

const ASSEMBLE_PAYLOAD_STEP_DESCRIPTION = `Build the payload: version, wrap name, parentMessageId, senderPublicJwk, the base64 HKDF salt from step 3, and encryptedContent from step 4. The salt—not the comment key—lets every recipient who has the DEK re-derive the same comment key to decrypt.`;

const SIGN_COMMENT_STEP_DESCRIPTION =
  'Sign the canonical JSON of the signable body with your long-term ECDSA P-256 private key. Recipients verify signature against sender public key before decrypting.';

const DEFAULT_COMMENT_TEXT =
  'Great post — adding a comment encrypted under the parent message DEK.';

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
        multiline
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

const PlaintextCommentInput = memo(function PlaintextCommentInput({
  getCommentPlaintextRef,
}: {
  getCommentPlaintextRef: RefObject<() => string>;
}) {
  const [commentText, setCommentText] = useState(DEFAULT_COMMENT_TEXT);

  useEffect(() => {
    getCommentPlaintextRef.current = () => commentText;
  });

  return (
    <StepOutputTextField
      label="Comment plaintext"
      value={commentText}
      onChange={(e) => setCommentText(e.target.value)}
      multiline
      rows={3}
      fullWidth
      onClick={() => {
        /* editable field */
      }}
    />
  );
});

function ImportCommentHkdfMaterialExampleCaption({
  example,
}: {
  example: ImportCommentHkdfMaterialExample | null;
}) {
  return (
    <StepExampleGrid columns={3}>
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
      <Typography
        variant="body2"
        color="text.secondary"
        sx={{ textAlign: 'center', px: { md: 0.5 } }}
      >
        → prepare for HKDF →
      </Typography>
      <StepOutputTextField
        label="HKDF key material (SHA-256 fingerprint of DEK)"
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

function DeriveCommentKeyExampleCaption({
  example,
}: {
  example: DeriveCommentKeyExample | null;
}) {
  return (
    <StepExampleGrid>
      <StepOutputTextField
        label="HKDF material (step 2, SHA-256 of DEK)"
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
        label="HKDF salt (Base64)"
        tooltipMessage="Included in payload"
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
        → HKDF →
      </Typography>
      <StepOutputTextField
        label="Comment key (AES-256-GCM)"
        value={example?.commentKeyBase64 ?? ''}
        multiline
        minRows={2}
        maxRows={4}
        fullWidth
        slotProps={{ input: { readOnly: true } }}
      />
    </StepExampleGrid>
  );
}

function EncryptCommentBodyExampleCaption({
  example,
  commentKeyBase64,
  getCommentPlaintextRef,
}: {
  example: EncryptCommentBodyExample | null;
  commentKeyBase64: string;
  getCommentPlaintextRef: RefObject<() => string>;
}) {
  const keyBase64 = example?.commentKeyBase64 ?? commentKeyBase64;
  const contentIvBase64 = example?.contentIvBase64 ?? '';
  const ciphertextBase64 = example?.ciphertextBase64 ?? '';

  return (
    <StepExampleGrid>
      <PlaintextCommentInput getCommentPlaintextRef={getCommentPlaintextRef} />

      <Typography
        variant="body2"
        color="text.secondary"
        sx={{ textAlign: 'center', px: { md: 0.5 } }}
      >
        +
      </Typography>

      <Box sx={{ display: 'flex', flexDirection: 'column', gap: 1 }}>
        <StepOutputTextField
          tooltipMessage="From step 3 — used for AES-GCM only, not sent on the wire"
          label="Comment key (AES-256-GCM, step 3)"
          value={keyBase64}
          multiline
          minRows={2}
          maxRows={4}
          fullWidth
          slotProps={{ input: { readOnly: true } }}
        />

        <StepOutputTextField
          color="success"
          tooltipMessage="Included in payload"
          label="Random comment IV (nonce)"
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
        label="Comment ciphertext"
        value={ciphertextBase64}
        multiline
        rows={4}
        fullWidth
        slotProps={{ input: { readOnly: true } }}
      />
    </StepExampleGrid>
  );
}

type CommentStepsPanelProps = ReturnType<typeof useEncryptCommentSteps>;

const CommentStepsPanel = memo(function CommentStepsPanel({
  steps,
  getCommentPlaintextRef,
  onCopyPayload,
  copyState,
}: {
  steps: CommentStepsPanelProps;
  getCommentPlaintextRef: RefObject<() => string>;
  onCopyPayload: () => void;
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
          Add comment
        </Typography>
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
          tooltipMessage="Same raw DEK that encrypted the message ciphertext"
          label="DEK"
          value={steps.dekOutput}
          multiline
          minRows={2}
          maxRows={4}
          fullWidth
          slotProps={{ input: { readOnly: true } }}
        />
      </Box>

      <Box sx={stepContentSx}>
        <StepActionRow
          content={
            <StepInfoAlert number={2} flow="encrypt">
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
        <ImportCommentHkdfMaterialExampleCaption
          example={steps.importHkdfMaterialExample}
        />
      </Box>

      <Box sx={stepContentSx}>
        <StepActionRow
          content={
            <StepInfoAlert number={3} flow="encrypt">
              {DERIVE_COMMENT_KEY_STEP_DESCRIPTION}
            </StepInfoAlert>
          }
        >
          <Button
            variant="outlined"
            color="success"
            loading={steps.busyStep === 'deriveCommentKey'}
            onClick={steps.runDeriveCommentKey}
            disabled={!steps.canRunDeriveCommentKey || steps.busyStep !== null}
          >
            Derive comment key
          </Button>
        </StepActionRow>
        {steps.error && steps.errorStep === 'deriveCommentKey' && (
          <Typography color="error" variant="body2">
            {steps.error}
          </Typography>
        )}
        <DeriveCommentKeyExampleCaption
          example={steps.deriveCommentKeyExample}
        />
      </Box>

      <Box sx={stepContentSx}>
        <StepActionRow
          content={
            <StepInfoAlert number={4} flow="encrypt">
              {ENCRYPT_COMMENT_BODY_STEP_DESCRIPTION}
            </StepInfoAlert>
          }
        >
          <Button
            variant="outlined"
            color="success"
            loading={steps.busyStep === 'encryptBody'}
            onClick={steps.runEncryptCommentBody}
            disabled={!steps.canRunEncryptBody || steps.busyStep !== null}
          >
            Encrypt comment
          </Button>
        </StepActionRow>
        {steps.error && steps.errorStep === 'encryptBody' && (
          <Typography color="error" variant="body2">
            {steps.error}
          </Typography>
        )}
        <EncryptCommentBodyExampleCaption
          example={steps.encryptCommentBodyExample}
          commentKeyBase64={steps.commentKeyOutput}
          getCommentPlaintextRef={getCommentPlaintextRef}
        />
      </Box>

      <Box sx={stepContentSx}>
        <StepActionRow
          content={
            <StepInfoAlert number={5} flow="encrypt">
              {ASSEMBLE_PAYLOAD_STEP_DESCRIPTION}
            </StepInfoAlert>
          }
        >
          <Button
            variant="outlined"
            color="success"
            loading={steps.busyStep === 'assemble'}
            onClick={steps.runAssemblePayload}
            disabled={
              !steps.keysReady ||
              !steps.canRunAssemble ||
              steps.busyStep !== null
            }
          >
            Assemble payload
          </Button>
        </StepActionRow>
        {steps.error && steps.errorStep === 'assemble' && (
          <Typography color="error" variant="body2">
            {steps.error}
          </Typography>
        )}
        <StepOutputTextField
          label="Signable comment body JSON"
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
            <StepInfoAlert number={6} flow="encrypt">
              {SIGN_COMMENT_STEP_DESCRIPTION}
            </StepInfoAlert>
          }
        >
          <Button
            variant="outlined"
            color="success"
            loading={steps.busyStep === 'sign'}
            onClick={steps.runSignComment}
            disabled={
              !steps.keysReady ||
              !steps.hasAssemblyDone ||
              steps.busyStep !== null
            }
          >
            Sign comment
          </Button>
        </StepActionRow>
        {steps.error && steps.errorStep === 'sign' && (
          <Typography color="error" variant="body2">
            {steps.error}
          </Typography>
        )}
        <StepOutputTextField
          color="success"
          tooltipMessage="Included in final payload"
          label="Signature (Base64, ES256)"
          value={steps.senderSignatureOutput}
          multiline
          rows={3}
          fullWidth
          slotProps={{ input: { readOnly: true } }}
        />
        <StepOutputTextField
          label="Signed comment payload JSON"
          value={steps.signedPayloadDisplay}
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

type EncryptCommentStepByStepProps = {
  demo: DemoParentFeedMessage | null;
  demoLoading?: boolean;
  demoError?: string | null;
};

export function EncryptCommentStepByStep({
  demo,
  demoLoading = false,
  demoError = null,
}: EncryptCommentStepByStepProps) {
  const [copyState, setCopyState] = useState<CopyState>('idle');
  const getCommentPlaintextRef = useRef<() => string>(() => '');
  const steps = useEncryptCommentSteps(demo, getCommentPlaintextRef);

  const handleCopyPayload = useCallback(async () => {
    if (!steps.signedPayloadJson) return;
    try {
      await copyTextToClipboard(steps.signedPayloadJson);
      setCopyState('ok');
    } catch {
      setCopyState('err');
    }
    window.setTimeout(() => setCopyState('idle'), 2000);
  }, [steps.signedPayloadJson]);

  if (demoLoading) {
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
      <CommentStepsPanel
        steps={steps}
        getCommentPlaintextRef={getCommentPlaintextRef}
        onCopyPayload={handleCopyPayload}
        copyState={copyState}
      />
    </Box>
  );
}
