import React, { useState } from 'react';
import Button from '@mui/material/Button';
import Menu from '@mui/material/Menu';
import MenuItem from '@mui/material/MenuItem';
import ArrowDropDownIcon from '@mui/icons-material/ArrowDropDown';
import { Link as RouterLink, useLocation } from 'react-router-dom';

export const PROOF_OF_CONCEPT_ITEMS = [
  { label: 'Feed', to: '/proof-of-concepts/feed' },
  { label: 'Feed Comment', to: '/proof-of-concepts/feed-comment' },
] as const;

export function isProofOfConceptsPath(pathname: string): boolean {
  return (
    pathname.startsWith('/proof-of-concepts') ||
    pathname === '/proof-of-concept'
  );
}

export function ProofOfConceptsNav() {
  const location = useLocation();
  const [anchorEl, setAnchorEl] = useState<null | HTMLElement>(null);
  const open = Boolean(anchorEl);
  const isActive = isProofOfConceptsPath(location.pathname);

  const handleOpen = (event: React.MouseEvent<HTMLButtonElement>) => {
    setAnchorEl(event.currentTarget);
  };

  const handleClose = () => {
    setAnchorEl(null);
  };

  return (
    <>
      <Button
        color="inherit"
        onClick={handleOpen}
        endIcon={<ArrowDropDownIcon />}
        aria-haspopup="true"
        aria-expanded={open ? 'true' : undefined}
        aria-controls={open ? 'proof-of-concepts-menu' : undefined}
        sx={{
          opacity: isActive ? 1 : 0.7,
          fontWeight: isActive ? 600 : 400,
        }}
      >
        Proof of concepts
      </Button>
      <Menu
        id="proof-of-concepts-menu"
        anchorEl={anchorEl}
        open={open}
        onClose={handleClose}
        anchorOrigin={{ vertical: 'bottom', horizontal: 'left' }}
        transformOrigin={{ vertical: 'top', horizontal: 'left' }}
      >
        {PROOF_OF_CONCEPT_ITEMS.map(({ label, to }) => (
          <MenuItem
            key={to}
            component={RouterLink}
            to={to}
            onClick={handleClose}
            selected={location.pathname === to}
          >
            {label}
          </MenuItem>
        ))}
      </Menu>
    </>
  );
}
