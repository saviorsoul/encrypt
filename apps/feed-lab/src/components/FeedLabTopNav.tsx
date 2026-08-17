import React from 'react';
import { Container, IconButton, Stack, Tooltip } from '@mui/material';
import PeopleOutlinedIcon from '@mui/icons-material/PeopleOutlined';
import { FeedntText } from '@lab/components/FeedntText.tsx';
import { FeedLabSettingsMenu } from '@lab/components/FeedLabSettingsMenu.tsx';
import { TooltipIconWrap } from '@encrypt/ui';

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
          justifyContent: 'space-between',
          gap: 0.5,
          width: '100%',
        }}
      >
        <FeedntText />
        <Stack direction="row" sx={{ alignItems: 'center', gap: 0.5 }}>
          <Tooltip title="Users">
            <TooltipIconWrap>
              <IconButton
                data-testid="nav-open-users"
                size="small"
                color={usersActive ? 'primary' : 'inherit'}
                aria-label="Users"
                aria-pressed={usersActive}
                onClick={onOpenUsers}
              >
                <PeopleOutlinedIcon />
              </IconButton>
            </TooltipIconWrap>
          </Tooltip>
          <FeedLabSettingsMenu />
        </Stack>
      </Stack>
    </Container>
  );
}
