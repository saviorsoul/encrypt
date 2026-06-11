import React from 'react';
import Box from '@mui/material/Box';
import Link from '@mui/material/Link';
import Typography from '@mui/material/Typography';
import { Link as RouterLink } from 'react-router-dom';
import { stepContentSx } from '@/components/manifest-steps/stepLayout.ts';
import {
  COMMENT_HKDF_INFO,
  COMMENT_VERSION,
  COMMENT_WRAP,
} from '@/crypto/commentConstants.ts';

export const COMMENT_CRYPTO_OVERVIEW =
  'A feed comment is encrypted under the same message DEK as its parent post—not under per-recipient KEKs. Anyone who can decrypt the post can decrypt its comments after verifying the author signature. The author uses their private key and their keyManifest entry on the parent feed manifest to recover that DEK before encrypting.';

const UNLOCK_DEK_STEP_DESCRIPTION =
  'Take the parent feed manifest and your recipient entry in keyManifest. With your ECDH private key, run the same ECDHE + HKDF + AES-GCM path used to decrypt a feed message, but stop after recovering the raw AES-256 DEK. Comments never re-wrap the DEK for other recipients.';

const HKDF_COMMENT_KEY_STEP_DESCRIPTION =
  'The DEK bytes are imported as HKDF key material (same Web Crypto import as manifest ECDH output). A fresh random salt is generated, then HKDF expands to a dedicated AES-256-GCM key using the fixed info string for comments. That key is separate from the message body key and from any recipient KEK.';

const ENCRYPT_COMMENT_BODY_STEP_DESCRIPTION =
  'Encrypt the comment plaintext with AES-GCM using the HKDF-derived comment key. The IV and ciphertext go into encryptedContent on the payload, using the same wire shape as manifest message bodies.';

const ASSEMBLE_PAYLOAD_STEP_DESCRIPTION = `Build the signable body: version ${COMMENT_VERSION}, wrap "${COMMENT_WRAP}", parentMessageId (the feed message id), your long-term senderPublicJwk, the base64 HKDF salt, and encryptedContent. The salt lets every recipient who has the DEK re-derive the same comment key.`;

const SIGN_COMMENT_STEP_DESCRIPTION =
  'Sign the canonical JSON of the signable body (everything except senderSignature) with your long-term ECDSA P-256 private key. Recipients verify senderSignature against senderPublicJwk before decrypting—same pattern as feed manifests, but the signed fields are comment-specific. The signed JSON is the wire payload your backend would accept and attach to the parent feed message.';

function CommentHkdfInfoCaption() {
  const infoText = new TextDecoder().decode(COMMENT_HKDF_INFO);
  return (
    <Typography
      variant="caption"
      color="text.secondary"
      component="div"
      sx={{ mt: 1 }}
    >
      HKDF info: <Box component="code">{infoText}</Box>
    </Typography>
  );
}

export function EncryptCommentStepByStep() {
  return (
    <Box sx={{ display: 'flex', flexDirection: 'column', gap: 1 }}>
      <Typography variant="body2" color="text.secondary" sx={{ mb: 1 }}>
        Parent feed encryption is covered on the{' '}
        <Link component={RouterLink} to="/proof-of-concepts/feed">
          Feed
        </Link>{' '}
        walkthrough. The steps below assume that manifest already exists and you
        can decrypt its DEK.
      </Typography>

      <Box sx={stepContentSx}>
        <Typography variant="body2" color="text.secondary">
          {UNLOCK_DEK_STEP_DESCRIPTION}
        </Typography>
      </Box>

      <Box sx={stepContentSx}>
        <Typography variant="body2" color="text.secondary">
          {HKDF_COMMENT_KEY_STEP_DESCRIPTION}
        </Typography>
        <CommentHkdfInfoCaption />
      </Box>

      <Box sx={stepContentSx}>
        <Typography variant="body2" color="text.secondary">
          {ENCRYPT_COMMENT_BODY_STEP_DESCRIPTION}
        </Typography>
      </Box>

      <Box sx={stepContentSx}>
        <Typography variant="body2" color="text.secondary">
          {ASSEMBLE_PAYLOAD_STEP_DESCRIPTION}
        </Typography>
      </Box>

      <Box sx={stepContentSx}>
        <Typography variant="body2" color="text.secondary">
          {SIGN_COMMENT_STEP_DESCRIPTION}
        </Typography>
      </Box>
    </Box>
  );
}
