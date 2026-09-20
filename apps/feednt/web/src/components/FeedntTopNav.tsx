import { Container, IconButton, Stack, Tooltip } from '@mui/material';
import PeopleOutlinedIcon from '@mui/icons-material/PeopleOutlined';
import { FeedntText } from '@encrypt/ui/FeedntText';
import { FeedntSettingsMenu } from '@feednt/components/FeedntSettingsMenu.tsx';
import { TooltipIconWrap } from '@encrypt/ui';

type FeedntTopNavProps = {
  usersActive: boolean;
  onOpenUsers: () => void;
};

export function FeedntTopNav({ usersActive, onOpenUsers }: FeedntTopNavProps) {
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
          <FeedntSettingsMenu />
        </Stack>
      </Stack>
    </Container>
  );
}
