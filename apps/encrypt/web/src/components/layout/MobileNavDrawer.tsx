import React, { useEffect } from 'react';
import Drawer from '@mui/material/Drawer';
import List from '@mui/material/List';
import ListItemButton from '@mui/material/ListItemButton';
import ListItemText from '@mui/material/ListItemText';
import IconButton from '@mui/material/IconButton';
import Box from '@mui/material/Box';
import Toolbar from '@mui/material/Toolbar';
import Typography from '@mui/material/Typography';
import CloseIcon from '@mui/icons-material/Close';
import { Link as RouterLink, useLocation } from 'react-router-dom';
import {
  PROOF_OF_CONCEPT_ITEMS,
  isProofOfConceptsPath,
} from '@/components/layout/ProofOfConceptsNav.tsx';

type NavItem = {
  label: string;
  to: string;
};

type MobileNavDrawerProps = {
  open: boolean;
  onClose: () => void;
  navItems: readonly NavItem[];
  isNavActive: (to: string) => boolean;
};

export function MobileNavDrawer({
  open,
  onClose,
  navItems,
  isNavActive,
}: MobileNavDrawerProps) {
  const location = useLocation();

  useEffect(() => {
    onClose();
  }, [location.pathname, onClose]);

  const listItemSx = {
    minWidth: 0,
    width: '100%',
    maxWidth: '100%',
    boxSizing: 'border-box',
    overflow: 'hidden',
  } as const;

  const listItemTextProps = {
    sx: { minWidth: 0, m: 0 },
    slotProps: {
      primary: {
        sx: {
          overflow: 'hidden',
          textOverflow: 'ellipsis',
          whiteSpace: 'nowrap',
        },
      },
    },
  } as const;

  return (
    <Drawer
      anchor="left"
      open={open}
      onClose={onClose}
      slotProps={{
        paper: {
          sx: {
            left: 0,
            right: 0,
            width: 'auto',
          },
        },
      }}
    >
      <Toolbar sx={{ justifyContent: 'space-between', px: 1, flexShrink: 0 }}>
        <Typography variant="h6" component="div" noWrap sx={{ minWidth: 0 }}>
          Menu
        </Typography>
        <IconButton color="inherit" onClick={onClose} aria-label="Close menu">
          <CloseIcon />
        </IconButton>
      </Toolbar>
      <Box component="nav">
        <List disablePadding sx={{ width: '100%', overflow: 'hidden' }}>
          {navItems.map(({ label, to }) => (
            <ListItemButton
              key={to}
              component={RouterLink}
              to={to}
              selected={isNavActive(to)}
              sx={listItemSx}
            >
              <ListItemText primary={label} {...listItemTextProps} />
            </ListItemButton>
          ))}
          <ListItemButton
            sx={{ ...listItemSx }}
            disabled
            selected={isProofOfConceptsPath(location.pathname)}
          >
            <ListItemText primary="Proof of concepts" {...listItemTextProps} />
          </ListItemButton>
          {PROOF_OF_CONCEPT_ITEMS.map(({ label, to }) => (
            <ListItemButton
              key={to}
              component={RouterLink}
              to={to}
              selected={location.pathname === to}
              sx={{ ...listItemSx, pl: 4 }}
            >
              <ListItemText primary={label} {...listItemTextProps} />
            </ListItemButton>
          ))}
        </List>
      </Box>
    </Drawer>
  );
}
