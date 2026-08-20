import React, {
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
} from 'react';
import Alert from '@mui/material/Alert';
import Box from '@mui/material/Box';
import Button from '@mui/material/Button';
import CircularProgress from '@mui/material/CircularProgress';
import Paper from '@mui/material/Paper';
import Stack from '@mui/material/Stack';
import TextField from '@mui/material/TextField';
import ToggleButton from '@mui/material/ToggleButton';
import ToggleButtonGroup from '@mui/material/ToggleButtonGroup';
import Typography from '@mui/material/Typography';
import {
  isInvitationTokenUuid,
  parseInvitationRoute,
} from '@encrypt/core/invite/invitationLink';
import { InvitationQrCodeDialog } from '@encrypt/ui/InvitationQrCodeDialog';
import { GdprConsentCheckbox } from '@encrypt/ui/GdprConsentCheckbox';
import {
  formatEcPublicKeyText,
  slimEcPublicJwk,
} from '@encrypt/core/crypto/ecPublicKey';
import { prettifyJsonText } from '@encrypt/core/utils/prettifyJsonText';
import { useNavigate, useParams } from 'react-router-dom';
import { useFeedApi } from '@feednt/providers/FeedApiProvider.tsx';
import { resolveDefaultInviteUsername } from '@feednt/lib/defaultInviteUsername.ts';
import {
  registerFeedntRecipient,
  isUserAlreadyExistsError,
} from '@feednt/lib/registerFeedntRecipient.ts';
import { useFeedntSession } from '@feednt/providers/FeedntSessionProvider.tsx';
import { InviteSuccessView } from '@feednt/components/InviteSuccessView.tsx';
import {
  loadFeedntUserByKeyId,
  loadFeedntUserByUsername,
  saveFeedntUser,
} from '@feednt/services/db/storedUsers.ts';
import type { FriendInvitationPublic } from '@encrypt/core/api/feedApi';

type InviteStep =
  | 'loading'
  | 'invalid'
  | 'used'
  | 'join'
  | 'accepting'
  | 'success';

type InviteSuccessVariant = 'accepted' | 'alreadyFriends';

function isAlreadyFriendsError(message: string): boolean {
  return message.toLowerCase().includes('already friends');
}

function isInvitationAlreadyUsedError(message: string): boolean {
  return message.toLowerCase().includes('already used');
}

async function validateInviterUsername(
  ownerKeyId: string | null,
  username: string,
  inviterKeyId: string,
): Promise<string | null> {
  const trimmed = username.trim();
  if (!trimmed || !ownerKeyId) {
    return null;
  }

  const existing = await loadFeedntUserByUsername(ownerKeyId, trimmed);
  if (existing && existing.keyId !== inviterKeyId) {
    return `"${trimmed}" is already used. Choose another name.`;
  }

  return null;
}

function formatPublicKeyText(
  publicKey: { x: string; y: string },
  format: 'xy' | 'json',
): string {
  const jwk = slimEcPublicJwk({
    kty: 'EC',
    crv: 'P-256',
    x: publicKey.x,
    y: publicKey.y,
  });
  if (format === 'json') {
    return prettifyJsonText(JSON.stringify(jwk));
  }
  return formatEcPublicKeyText(jwk);
}

function InvitePageShell({ children }: { children: React.ReactNode }) {
  return (
    <Box
      sx={{
        maxWidth: 600,
        width: '100%',
        mx: 'auto',
        px: 2,
        py: 3,
      }}
    >
      {children}
    </Box>
  );
}

export function InvitePage() {
  const { token: routeToken } = useParams<{ token: string }>();
  const navigate = useNavigate();
  const api = useFeedApi();
  const { session, sessionError, keys, feedntUsers } = useFeedntSession();
  const { addLocalUser, refresh: refreshFeedntUsers } = feedntUsers;
  const keyId = session?.keyId ?? keys.keyId;
  const publicKey = session?.publicKey;

  const [step, setStep] = useState<InviteStep>('loading');
  const [loadError, setLoadError] = useState<string | null>(null);
  const [invitation, setInvitation] = useState<FriendInvitationPublic | null>(
    null,
  );
  const [publicKeyFormat, setPublicKeyFormat] = useState<'xy' | 'json'>('xy');
  const [inviterPublicKeyFormat, setInviterPublicKeyFormat] = useState<
    'xy' | 'json'
  >('xy');
  const [inviterName, setInviterName] = useState('');
  const [inviterNameError, setInviterNameError] = useState<string | null>(null);
  const [acceptError, setAcceptError] = useState<string | null>(null);
  const [successVariant, setSuccessVariant] =
    useState<InviteSuccessVariant>('accepted');
  const inviteFlowFinishedRef = useRef(false);
  const [qrDialogOpen, setQrDialogOpen] = useState(false);
  const [gdprConsent, setGdprConsent] = useState(false);

  const invitationId = routeToken?.trim() ?? '';

  const inviterDisplayLabel =
    inviterName.trim() ||
    (invitation ? `${invitation.inviterKeyId.slice(0, 12)}…` : 'inviter');

  useEffect(() => {
    if (inviteFlowFinishedRef.current) {
      return;
    }

    let cancelled = false;

    async function loadInvitation() {
      const token = routeToken?.trim() ?? '';
      const route = parseInvitationRoute(`/invite/${token}`);
      if (!route || !isInvitationTokenUuid(route.token)) {
        setLoadError('This invitation ID is invalid.');
        setStep('invalid');
        return;
      }

      try {
        const row = await api.getFriendInvitation(route.token);
        if (cancelled || inviteFlowFinishedRef.current) {
          return;
        }
        setInvitation(row);
        setStep((current) => (current === 'loading' ? 'join' : current));
      } catch (e) {
        if (cancelled || inviteFlowFinishedRef.current) {
          return;
        }
        const message =
          e instanceof Error ? e.message : 'Could not load invitation.';
        if (message.toLowerCase().includes('already used')) {
          setStep('used');
          return;
        }
        setLoadError(message);
        setStep('invalid');
      }
    }

    void loadInvitation();

    return () => {
      cancelled = true;
    };
  }, [api, routeToken]);

  const publicKeyText = useMemo(() => {
    if (!publicKey) {
      return '';
    }
    return formatPublicKeyText(publicKey, publicKeyFormat);
  }, [publicKey, publicKeyFormat]);

  const inviterPublicKeyText = useMemo(() => {
    if (!invitation) {
      return '';
    }
    return formatPublicKeyText(
      invitation.inviterPublicKey,
      inviterPublicKeyFormat,
    );
  }, [invitation, inviterPublicKeyFormat]);

  const saveInviterLocally = useCallback(async () => {
    if (!invitation) {
      return;
    }

    const ownerKeyId = keyId;
    if (!ownerKeyId) {
      return;
    }
    const inviterUsername =
      inviterName.trim() || `inviter-${invitation.inviterKeyId.slice(0, 8)}`;
    try {
      await saveFeedntUser(
        ownerKeyId,
        inviterUsername,
        {
          kty: 'EC',
          crv: 'P-256',
          x: invitation.inviterPublicKey.x,
          y: invitation.inviterPublicKey.y,
        },
        { acceptedInvitationToken: invitation.token },
      );
      addLocalUser({
        keyId: invitation.inviterKeyId,
        username: inviterUsername,
      });
      await refreshFeedntUsers(ownerKeyId);
    } catch {
      /* local save is best-effort */
    }
  }, [addLocalUser, invitation, inviterName, keyId, refreshFeedntUsers]);

  const finishInviteSuccess = useCallback(
    async (variant: InviteSuccessVariant) => {
      await saveInviterLocally();
      inviteFlowFinishedRef.current = true;
      setSuccessVariant(variant);
      setStep('success');
    },
    [saveInviterLocally],
  );

  const handleAcceptInvitation = useCallback(async () => {
    if (!invitation || !keyId || !publicKey) {
      setAcceptError('Unlock your private key to accept this invitation.');
      return;
    }

    const inviterUsernameError = await validateInviterUsername(
      keyId,
      inviterName,
      invitation.inviterKeyId,
    );
    if (inviterUsernameError) {
      setInviterNameError(inviterUsernameError);
      return;
    }

    setAcceptError(null);
    setInviterNameError(null);
    setStep('accepting');

    try {
      const existingLocal = await loadFeedntUserByKeyId(keyId, keyId);
      const username =
        existingLocal?.username ?? (await resolveDefaultInviteUsername(keyId));
      const publicJwk = slimEcPublicJwk({
        kty: 'EC',
        crv: 'P-256',
        x: publicKey.x,
        y: publicKey.y,
      });

      const registration = await registerFeedntRecipient(
        keyId,
        username,
        publicJwk,
        {
          acceptedInvitationToken: invitation.token,
        },
      );
      if (registration.status === 'error') {
        throw new Error(registration.message);
      }

      if (registration.status === 'registered') {
        addLocalUser({
          keyId: registration.user.keyId,
          username: registration.user.username,
        });
      } else if (registration.status === 'already_saved') {
        addLocalUser({
          keyId: registration.keyId,
          username: registration.username,
        });
      }
      await refreshFeedntUsers(keyId);

      await api.acceptFriendInvitation(invitation.token);
      await finishInviteSuccess('accepted');
    } catch (e) {
      const message =
        e instanceof Error ? e.message : 'Could not accept invitation.';

      if (
        isAlreadyFriendsError(message) ||
        isUserAlreadyExistsError(message) ||
        isInvitationAlreadyUsedError(message)
      ) {
        await finishInviteSuccess('alreadyFriends');
        return;
      }

      setAcceptError(message);
      setStep('join');
    }
  }, [
    addLocalUser,
    api,
    finishInviteSuccess,
    invitation,
    inviterName,
    keyId,
    publicKey,
    refreshFeedntUsers,
  ]);

  if (step === 'loading') {
    return (
      <InvitePageShell>
        <Box sx={{ display: 'flex', justifyContent: 'center', py: 5 }}>
          <CircularProgress aria-label="Loading invitation" />
        </Box>
      </InvitePageShell>
    );
  }

  if (step === 'accepting') {
    return (
      <InvitePageShell>
        <Paper sx={{ p: 3 }}>
          <Stack spacing={2} sx={{ alignItems: 'center' }}>
            <CircularProgress aria-label="Accepting invitation" />
            <Typography variant="body2" color="text.secondary" align="center">
              Signing and accepting your invitation…
            </Typography>
          </Stack>
        </Paper>
      </InvitePageShell>
    );
  }

  if (step === 'success') {
    return (
      <InvitePageShell>
        <InviteSuccessView
          inviterName={inviterDisplayLabel}
          publicKeyText={publicKeyText}
          publicKeyFormat={publicKeyFormat}
          variant={successVariant}
          onPublicKeyFormatChange={setPublicKeyFormat}
          onOpenFeed={() => navigate('/feed')}
        />
      </InvitePageShell>
    );
  }

  if (step === 'invalid') {
    return (
      <InvitePageShell>
        <Paper sx={{ p: 3 }}>
          <Alert severity="error" sx={{ mb: 2 }}>
            {loadError ?? 'Invitation not found.'}
          </Alert>
          <Button variant="contained" onClick={() => navigate('/users')}>
            Go to Users
          </Button>
        </Paper>
      </InvitePageShell>
    );
  }

  if (step === 'used') {
    return (
      <InvitePageShell>
        <Paper sx={{ p: 3 }}>
          <Alert severity="warning" sx={{ mb: 2 }}>
            This invitation has already been used and cannot be opened again.
          </Alert>
          <Button variant="contained" onClick={() => navigate('/users')}>
            Go to Users
          </Button>
        </Paper>
      </InvitePageShell>
    );
  }

  return (
    <InvitePageShell>
      <Paper sx={{ p: 3 }}>
        <Stack spacing={2}>
          <Typography variant="h6" align="center">
            Accept invite
          </Typography>
          <Typography variant="body2" color="text.secondary" align="center">
            Verify the public key below, then accept with your key in this app.
          </Typography>

          {invitationId ? (
            <>
              <TextField
                data-testid="invite-invitation-id"
                label="Invitation ID"
                value={invitationId}
                fullWidth
                multiline
                minRows={2}
                slotProps={{
                  input: {
                    readOnly: true,
                    sx: { fontFamily: 'monospace', fontSize: '0.75rem' },
                  },
                }}
              />
              <Button
                data-testid="invite-show-qr-code"
                variant="outlined"
                fullWidth
                onClick={() => setQrDialogOpen(true)}
              >
                Show QR code
              </Button>
            </>
          ) : null}

          <ToggleButtonGroup
            value={inviterPublicKeyFormat}
            exclusive
            onChange={(_, next: 'xy' | 'json' | null) => {
              if (next) {
                setInviterPublicKeyFormat(next);
              }
            }}
            size="small"
          >
            <ToggleButton value="xy">x;y</ToggleButton>
            <ToggleButton value="json">JSON</ToggleButton>
          </ToggleButtonGroup>
          <TextField
            label="Inviter public key"
            value={inviterPublicKeyText}
            fullWidth
            multiline
            minRows={inviterPublicKeyFormat === 'json' ? 6 : 2}
            slotProps={{
              input: {
                readOnly: true,
                sx: { fontFamily: 'monospace', fontSize: '0.75rem' },
              },
            }}
          />

          <TextField
            label="Name for the person who invited you"
            value={inviterName}
            onChange={(e) => {
              setInviterName(e.target.value);
              setInviterNameError(null);
              setAcceptError(null);
            }}
            fullWidth
            placeholder={
              invitation
                ? `inviter-${invitation.inviterKeyId.slice(0, 8)}`
                : undefined
            }
            helperText={
              inviterNameError ??
              'Optional. Stored only on this device to identify them.'
            }
            error={inviterNameError != null}
          />

          {acceptError ? <Alert severity="error">{acceptError}</Alert> : null}
          {sessionError ? <Alert severity="error">{sessionError}</Alert> : null}

          <GdprConsentCheckbox
            checked={gdprConsent}
            onChange={setGdprConsent}
          />

          <Button
            data-testid="invite-accept"
            variant="contained"
            fullWidth
            disabled={!keyId || !gdprConsent}
            onClick={() => void handleAcceptInvitation()}
          >
            Accept invite
          </Button>

          <Button
            data-testid="invite-cancel"
            variant="outlined"
            fullWidth
            onClick={() => navigate('/feed')}
          >
            Cancel
          </Button>
        </Stack>
      </Paper>
      {routeToken?.trim() ? (
        <InvitationQrCodeDialog
          open={qrDialogOpen}
          token={routeToken.trim()}
          onClose={() => setQrDialogOpen(false)}
        />
      ) : null}
    </InvitePageShell>
  );
}
