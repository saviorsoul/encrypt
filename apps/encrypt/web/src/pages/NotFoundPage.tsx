import Box from '@mui/material/Box';
import Button from '@mui/material/Button';
import Paper from '@mui/material/Paper';
import Stack from '@mui/material/Stack';
import Typography from '@mui/material/Typography';
import { Link as RouterLink } from 'react-router-dom';

type NotFoundPageProps = {
  code?: string;
  title?: string;
  message?: string;
  actionLabel?: string;
  actionTo?: string;
  onAction?: () => void;
};

export function NotFoundPage({
  code = '404',
  title = 'Page not found',
  message = "The page you're looking for doesn't exist or was moved.",
  actionLabel = 'Go home',
  actionTo = '/',
  onAction,
}: NotFoundPageProps) {
  return (
    <Box
      sx={{
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        minHeight: '50vh',
        px: 2,
        py: 4,
      }}
    >
      <Paper sx={{ p: 4, maxWidth: 480, width: '100%' }} elevation={2}>
        <Stack spacing={2} sx={{ alignItems: 'center', textAlign: 'center' }}>
          <Typography
            variant="h3"
            component="p"
            color="text.secondary"
            sx={{ fontFamily: 'monospace', fontWeight: 700 }}
          >
            {code}
          </Typography>
          <Typography
            variant="h5"
            component="h1"
            sx={{ fontFamily: 'monospace' }}
          >
            {title}
          </Typography>
          <Typography variant="body1" color="text.secondary">
            {message}
          </Typography>
          {onAction ? (
            <Button variant="contained" size="large" onClick={onAction}>
              {actionLabel}
            </Button>
          ) : (
            <Button
              variant="contained"
              size="large"
              component={RouterLink}
              to={actionTo}
            >
              {actionLabel}
            </Button>
          )}
        </Stack>
      </Paper>
    </Box>
  );
}
