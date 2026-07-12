import React from 'react';
import {
  Box,
  Container,
  Drawer,
  IconButton,
  Stack,
  Typography,
} from '@mui/material';
import CloseIcon from '@mui/icons-material/Close';
import { UsersPage } from '@lab/pages/UsersPage.tsx';

type UsersDrawerProps = {
  open: boolean;
  onClose: () => void;
};

export function UsersDrawer({ open, onClose }: UsersDrawerProps) {
  return (
    <Drawer
      anchor="bottom"
      open={open}
      onClose={onClose}
      slotProps={{
        paper: {
          sx: (theme) => ({
            left: 0,
            right: 0,
            mx: 'auto',
            width: '100%',
            maxWidth: theme.breakpoints.values.sm,
            maxHeight: '85vh',
            borderTopLeftRadius: 12,
            borderTopRightRadius: 12,
          }),
        },
      }}
    >
      <Container maxWidth="sm" sx={{ py: 2 }}>
        <Stack spacing={2}>
          <Stack
            direction="row"
            sx={{ alignItems: 'center', justifyContent: 'space-between' }}
          >
            <Typography variant="h6">Users</Typography>
            <IconButton aria-label="Close users" onClick={onClose} edge="end">
              <CloseIcon />
            </IconButton>
          </Stack>
          <Box sx={{ overflow: 'auto' }}>
            <UsersPage />
          </Box>
        </Stack>
      </Container>
    </Drawer>
  );
}
