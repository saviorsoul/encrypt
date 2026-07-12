import React from 'react';
import { Container, IconButton, Stack, Tooltip } from '@mui/material';
import PeopleOutlinedIcon from '@mui/icons-material/PeopleOutlined';
import { FeedLabSettingsMenu } from '@lab/components/FeedLabSettingsMenu.tsx';

type FeedLabTopNavProps = {
  usersActive: boolean;
  onOpenUsers: () => void;
};

export function FeedLabTopNav({
  usersActive,
  onOpenUsers,
}: FeedLabTopNavProps) {
  return (
    <Container maxWidth="sm" component="nav" sx={{ py: 0.25 }}>
      <Stack
        direction="row"
        sx={{
          alignItems: 'center',
          justifyContent: 'flex-end',
          gap: 0.5,
          width: '100%',
        }}
      >
        <Tooltip title="Users">
          <IconButton
            size="small"
            color={usersActive ? 'primary' : 'inherit'}
            aria-label="Users"
            aria-pressed={usersActive}
            onClick={onOpenUsers}
          >
            <PeopleOutlinedIcon />
          </IconButton>
        </Tooltip>
        <FeedLabSettingsMenu />
      </Stack>
    </Container>
  );
}
