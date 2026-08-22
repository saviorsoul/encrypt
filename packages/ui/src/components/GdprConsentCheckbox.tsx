import Checkbox from '@mui/material/Checkbox';
import FormControlLabel from '@mui/material/FormControlLabel';
import Link from '@mui/material/Link';
import Typography from '@mui/material/Typography';
import { gdprPageHref } from '../utils/gdprPageHref.ts';

export type GdprConsentCheckboxProps = {
  checked: boolean;
  onChange: (checked: boolean) => void;
  disabled?: boolean;
};

export function GdprConsentCheckbox({
  checked,
  onChange,
  disabled = false,
}: GdprConsentCheckboxProps) {
  return (
    <FormControlLabel
      disabled={disabled}
      control={
        <Checkbox
          data-testid="invite-gdpr-consent"
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
            href={gdprPageHref({ withReturnUrl: true })}
            underline="always"
            variant="body2"
          >
            personal data notice
          </Link>{' '}
          and understand how my data is stored before accepting this invitation.
        </Typography>
      }
      sx={{ alignItems: 'flex-start', mx: 0 }}
    />
  );
}
