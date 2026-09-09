import Checkbox from '@mui/material/Checkbox';
import FormControlLabel from '@mui/material/FormControlLabel';
import Link from '@mui/material/Link';
import Typography from '@mui/material/Typography';
import { gdprPageHref } from '../utils/gdprPageHref.ts';

export type GdprConsentCheckboxProps = {
  checked: boolean;
  onChange: (checked: boolean) => void;
  disabled?: boolean;
  /** `login` — open-mode sign-in; `invite` — invitation accept (default). */
  purpose?: 'invite' | 'login';
  /** Open the personal data notice in a new tab so the current page stays loaded. */
  openGdprInNewTab?: boolean;
};

const PURPOSE_SUFFIX: Record<
  NonNullable<GdprConsentCheckboxProps['purpose']>,
  string
> = {
  invite: 'before accepting this invitation',
  login: 'before signing in to the app',
};

export function GdprConsentCheckbox({
  checked,
  onChange,
  disabled = false,
  purpose = 'invite',
  openGdprInNewTab = false,
}: GdprConsentCheckboxProps) {
  return (
    <FormControlLabel
      disabled={disabled}
      control={
        <Checkbox
          data-testid={
            purpose === 'login' ? 'login-gdpr-consent' : 'invite-gdpr-consent'
          }
          checked={checked}
          onChange={(_, next) => onChange(next)}
          slotProps={{
            input: {
              'aria-required': true,
            },
          }}
        />
      }
      label={
        <Typography variant="body2" component="span">
          <Typography
            component="span"
            sx={{ color: 'error.main', mr: 0.25 }}
            aria-hidden
          >
            *
          </Typography>
          I have read the{' '}
          <Link
            href={gdprPageHref(openGdprInNewTab ? { newTab: true } : {})}
            target={openGdprInNewTab ? '_blank' : undefined}
            rel={openGdprInNewTab ? 'noopener noreferrer' : undefined}
            underline="always"
            variant="body2"
          >
            personal data notice
          </Link>{' '}
          and understand how my data is stored {PURPOSE_SUFFIX[purpose]}.
        </Typography>
      }
      sx={{ alignItems: 'flex-start', mx: 0 }}
    />
  );
}
