import React, {
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
} from 'react';
import UploadFileOutlinedIcon from '@mui/icons-material/UploadFileOutlined';
import Alert from '@mui/material/Alert';
import Box from '@mui/material/Box';
import Button from '@mui/material/Button';
import CircularProgress from '@mui/material/CircularProgress';
import Paper from '@mui/material/Paper';
import Stack from '@mui/material/Stack';
import TextField from '@mui/material/TextField';
import ToggleButton from '@mui/material/ToggleButton';
import ToggleButtonGroup from '@mui/material/ToggleButtonGroup';
import Tooltip from '@mui/material/Tooltip';
import Typography from '@mui/material/Typography';
import { parseInvitationRoute } from '@encrypt/core/invite/invitationLink';
import {
  formatEcPublicKeyText,
  slimEcPublicJwk,
} from '@encrypt/core/crypto/ecPublicKey';
import { useNavigate, useParams } from 'react-router-dom';
import { useFeedApi } from '@lab/providers/FeedApiProvider.tsx';
import { resolveDefaultInviteUsername } from '@lab/lib/defaultInviteUsername.ts';
import {
  registerFeedLabRecipient,
  isUserAlreadyExistsError,
} from '@lab/lib/registerFeedLabRecipient.ts';
import { useFeedLabSession } from '@lab/providers/FeedLabSessionProvider.tsx';
import { useBackendFriendInvitations } from '@lab/hooks/useBackendFriendInvitations.ts';
import { useBackendGenerateUser } from '@lab/hooks/useBackendGenerateUser.ts';
import {
  loadFeedLabUserByKeyId,
  loadFeedLabUserByUsername,
  saveFeedLabUser,
} from '@lab/services/db/storedUsers.ts';
import { InviteSuccessView } from '@lab/components/InviteSuccessView.tsx';
import { prettifyJsonText } from '@/utils/prettifyJsonText.ts';
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

  const existing = await loadFeedLabUserByUsername(ownerKeyId, trimmed);
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
  const { keys, feedLabUsers } = useFeedLabSession();
  const { addLocalUser, refresh: refreshFeedLabUsers } = feedLabUsers;

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

  const friendshipsRefresh = useCallback(async () => {
    /* invite page only needs local user list updates */
  }, []);

  const friendInvitations = useBackendFriendInvitations(friendshipsRefresh);
  const generateUser = useBackendGenerateUser((user) => {
    addLocalUser({ keyId: user.keyId, username: user.username });
  });
  const [keyPairGenerated, setKeyPairGenerated] = useState(false);

  const inviterDisplayLabel =
    inviterName.trim() ||
    (invitation ? `${invitation.inviterKeyId.slice(0, 12)}…` : 'inviter');

  useEffect(() => {
    if (inviteFlowFinishedRef.current) {
      return;
    }

    let cancelled = false;

    async function loadInvitation() {
      const route = parseInvitationRoute(`/invite/${routeToken ?? ''}`);
      if (!route || !routeToken) {
        setLoadError('This invitation link is invalid.');
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
    if (!keys.publicKey) {
      return '';
    }
    return formatPublicKeyText(keys.publicKey, publicKeyFormat);
  }, [keys.publicKey, publicKeyFormat]);

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

    const material = await keys.getPrivateKeyMaterial();
    if (!material) {
      return;
    }

    const ownerKeyId = material.keyId;
    const inviterUsername =
      inviterName.trim() || `inviter-${invitation.inviterKeyId.slice(0, 8)}`;
    try {
      await saveFeedLabUser(
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
      await refreshFeedLabUsers(ownerKeyId);
    } catch {
      /* local save is best-effort */
    }
  }, [addLocalUser, invitation, inviterName, keys, refreshFeedLabUsers]);

  const isAlreadyFriendsWithInviter = useCallback(async () => {
    if (!invitation) {
      return false;
    }

    try {
      const friendships = await keys.withPrivateKey(() => api.getFriendships());
      if (!friendships) {
        return false;
      }

      return friendships.some(
        (friendship) => friendship.friendKeyId === invitation.inviterKeyId,
      );
    } catch {
      // Invitee is not on the backend until accept registers them.
      return false;
    }
  }, [api, invitation, keys]);

  const finishInviteSuccess = useCallback(
    async (variant: InviteSuccessVariant) => {
      await saveInviterLocally();
      inviteFlowFinishedRef.current = true;
      setSuccessVariant(variant);
      setStep('success');
    },
    [saveInviterLocally],
  );

  const handleImportPrivateKey = useCallback(async () => {
    if (!invitation) {
      return;
    }

    keys.clearSessionError();
    setAcceptError(null);
    setInviterNameError(null);
    friendInvitations.clearError();

    const keyId = await keys.changeKeyId();
    if (!keyId) {
      return;
    }

    const material = await keys.getPrivateKeyMaterial();
    if (!material) {
      return;
    }

    const inviterUsernameError = await validateInviterUsername(
      material.keyId,
      inviterName,
      invitation.inviterKeyId,
    );
    if (inviterUsernameError) {
      setInviterNameError(inviterUsernameError);
      return;
    }

    const existingLocal = await loadFeedLabUserByKeyId(
      material.keyId,
      material.keyId,
    );

    setStep('accepting');

    try {
      const username =
        existingLocal?.username ??
        (await resolveDefaultInviteUsername(material.keyId));
      const publicJwk = slimEcPublicJwk({
        kty: 'EC',
        crv: 'P-256',
        x: material.publicKey.x,
        y: material.publicKey.y,
      });

      const registration = await registerFeedLabRecipient(
        material.keyId,
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
      await refreshFeedLabUsers(material.keyId);

      if (await isAlreadyFriendsWithInviter()) {
        try {
          await keys.withPrivateKey(async () => {
            await api.acceptFriendInvitation(invitation.token);
          });
        } catch {
          /* invitation may already be consumed */
        }
        await finishInviteSuccess('alreadyFriends');
        return;
      }

      const accepted = await keys.withPrivateKey(async () => {
        await api.acceptFriendInvitation(invitation.token);
        return true;
      });
      if (!accepted) {
        throw new Error('Private key session was not available.');
      }

      await finishInviteSuccess('accepted');
    } catch (e) {
      const message =
        e instanceof Error ? e.message : 'Could not accept invitation.';

      if (
        isAlreadyFriendsError(message) ||
        ((isUserAlreadyExistsError(message) ||
          isInvitationAlreadyUsedError(message)) &&
          (await isAlreadyFriendsWithInviter()))
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
    friendInvitations,
    invitation,
    inviterName,
    isAlreadyFriendsWithInviter,
    keys,
    refreshFeedLabUsers,
  ]);

  const handleGenerateKeyPair = useCallback(async () => {
    setInviterNameError(null);
    if (!invitation) {
      return;
    }

    const inviterUsernameError = await validateInviterUsername(
      keys.keyId,
      inviterName,
      invitation.inviterKeyId,
    );
    if (inviterUsernameError) {
      setInviterNameError(inviterUsernameError);
      return;
    }

    const username = await resolveDefaultInviteUsername(keys.keyId);
    const keyId = await generateUser.generateUser(username);
    if (keyId) {
      setKeyPairGenerated(true);
    }
  }, [generateUser, invitation, inviterName, keys.keyId]);

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
          onOpenUsers={() => navigate('/users')}
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
            This invitation link has already been used and cannot be opened
            again.
          </Alert>
          <Button variant="contained" onClick={() => navigate('/users')}>
            Go to Users
          </Button>
        </Paper>
      </InvitePageShell>
    );
  }

  const busy = generateUser.busy;

  return (
    <InvitePageShell>
      <Paper sx={{ p: 3 }}>
        <Stack spacing={2}>
          <Typography variant="h6" align="center">
            Accept invitation
          </Typography>
          <Typography variant="body2" color="text.secondary" align="center">
            Verify the public key below, then generate a key pair or use an
            existing private key to accept this one-time invitation.
          </Typography>
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
              'Optional. Stored only in your browser to identify them in Feed Lab.'
            }
            error={inviterNameError != null}
            disabled={busy}
          />

          {keyPairGenerated ? (
            <Alert severity="info">
              Private key downloaded. Use your private key file below to accept
              the invitation.
            </Alert>
          ) : null}
          {friendInvitations.error ? (
            <Alert severity="error">{friendInvitations.error}</Alert>
          ) : null}
          {acceptError ? <Alert severity="error">{acceptError}</Alert> : null}
          {generateUser.error ? (
            <Alert severity="error">{generateUser.error}</Alert>
          ) : null}
          {keys.sessionError ? (
            <Alert severity="error">{keys.sessionError}</Alert>
          ) : null}

          <Button
            variant="outlined"
            disabled={busy}
            onClick={() => {
              generateUser.clearError();
              friendInvitations.clearError();
              setAcceptError(null);
              void handleGenerateKeyPair();
            }}
          >
            {generateUser.busy ? 'Generating…' : 'Generate new key pair'}
          </Button>

          <Tooltip
            title="Your private key file is read only in this browser to sign the accept request. The key is not uploaded — the server only verifies a signature."
            arrow
          >
            <Box component="span" sx={{ display: 'block', width: '100%' }}>
              <Button
                variant="contained"
                fullWidth
                startIcon={<UploadFileOutlinedIcon />}
                disabled={busy}
                onClick={() => {
                  setAcceptError(null);
                  void handleImportPrivateKey();
                }}
              >
                Use private key to accept
              </Button>
            </Box>
          </Tooltip>
        </Stack>
      </Paper>
    </InvitePageShell>
  );
}
