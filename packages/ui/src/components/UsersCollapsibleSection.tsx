import ExpandLessOutlinedIcon from '@mui/icons-material/ExpandLessOutlined';
import ExpandMoreOutlinedIcon from '@mui/icons-material/ExpandMoreOutlined';
import { Collapse, Divider, Stack, Typography } from '@mui/material';
import { useState, type ReactNode } from 'react';

export type UsersCollapsibleSectionProps = {
  title: ReactNode;
  defaultExpanded?: boolean;
  children: ReactNode;
};

export function UsersCollapsibleSection({
  title,
  defaultExpanded = true,
  children,
}: UsersCollapsibleSectionProps) {
  const [expanded, setExpanded] = useState(defaultExpanded);

  return (
    <Stack spacing={1}>
      <Stack
        direction="row"
        spacing={0.5}
        role="button"
        tabIndex={0}
        aria-expanded={expanded}
        onClick={() => setExpanded((current) => !current)}
        onKeyDown={(event) => {
          if (event.key === 'Enter' || event.key === ' ') {
            event.preventDefault();
            setExpanded((current) => !current);
          }
        }}
        sx={{
          alignItems: 'center',
          cursor: 'pointer',
          userSelect: 'none',
        }}
      >
        {expanded ? (
          <ExpandLessOutlinedIcon
            aria-hidden
            sx={{ fontSize: 18, flexShrink: 0 }}
          />
        ) : (
          <ExpandMoreOutlinedIcon
            aria-hidden
            sx={{ fontSize: 18, flexShrink: 0 }}
          />
        )}
        <Typography variant="subtitle2" sx={{ flexShrink: 0 }}>
          {title}
        </Typography>
        <Divider sx={{ flex: 1 }} />
      </Stack>
      <Collapse in={expanded}>
        <Stack spacing={1}>{children}</Stack>
      </Collapse>
    </Stack>
  );
}
