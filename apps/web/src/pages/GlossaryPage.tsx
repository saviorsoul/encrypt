import React, { useEffect, useMemo } from 'react';
import Box from '@mui/material/Box';
import Paper from '@mui/material/Paper';
import Stack from '@mui/material/Stack';
import Typography from '@mui/material/Typography';
import List from '@mui/material/List';
import ListItemButton from '@mui/material/ListItemButton';
import ListItemText from '@mui/material/ListItemText';
import { Link as RouterLink, useLocation } from 'react-router-dom';
import { GlossaryLink } from '@/components/glossary/GlossaryLink.tsx';
import { glossaryHref } from '@/utils/glossaryPaths.ts';
import {
  glossaryTermsInDisplayOrder,
  type GlossaryTerm,
} from '@/utils/glossaryTerms.ts';

function scrollToTerm(id: string) {
  const el = document.getElementById(id);
  if (!el) return;
  el.scrollIntoView({ behavior: 'smooth', block: 'start' });
}

function GlossaryEntry({ term }: { term: GlossaryTerm }) {
  const isChild = Boolean(term.parentId);

  return (
    <Paper
      id={term.id}
      component="section"
      elevation={0}
      sx={{
        scrollMarginTop: 88,
        p: 2,
        pl: isChild ? 4 : 2,
        border: 1,
        borderColor: 'divider',
        bgcolor: 'background.paper',
      }}
    >
      <Typography
        variant={isChild ? 'subtitle1' : 'h6'}
        component="h2"
        gutterBottom
        sx={{ fontWeight: isChild ? 500 : 600 }}
      >
        {term.title}
      </Typography>
      <Typography variant="body2" color="text.secondary">
        {term.summary}
      </Typography>
      {term.inAppPurpose && term.inAppPurpose.length > 0 ? (
        <Typography variant="body2" color="text.secondary" sx={{ mt: 1 }}>
          <Box component="span" sx={{ fontStyle: 'italic' }}>
            In app purpose:{' '}
          </Box>
          {term.inAppPurpose}
        </Typography>
      ) : null}
      {term.seeAlso && term.seeAlso.length > 0 ? (
        <Typography variant="body2" color="text.secondary" sx={{ mt: 1 }}>
          See also:{' '}
          {term.seeAlso.map((relatedId, index) => (
            <React.Fragment key={relatedId}>
              {index > 0 ? ', ' : null}
              <GlossaryLink termId={relatedId} />
            </React.Fragment>
          ))}
        </Typography>
      ) : null}
    </Paper>
  );
}

export function GlossaryPage() {
  const location = useLocation();
  const terms = useMemo(() => glossaryTermsInDisplayOrder(), []);

  const activeId = useMemo(() => {
    const hash = location.hash.replace(/^#/, '');
    return hash || null;
  }, [location.hash]);

  useEffect(() => {
    if (!activeId) return;
    scrollToTerm(activeId);
  }, [activeId]);

  return (
    <Box sx={{ mx: 'auto', maxWidth: 900, px: 2, py: 2 }}>
      <Stack spacing={3}>
        <Box>
          <Typography variant="h5" component="h1" gutterBottom>
            Glossary
          </Typography>
        </Box>

        <Paper variant="outlined" sx={{ p: 2 }}>
          <Typography variant="subtitle2" gutterBottom>
            On this page
          </Typography>
          <List dense disablePadding>
            {terms.map((term) => (
              <ListItemButton
                key={term.id}
                component={RouterLink}
                to={glossaryHref(term.id)}
                sx={{ pl: term.parentId ? 3 : 1 }}
              >
                <ListItemText primary={term.title} />
              </ListItemButton>
            ))}
          </List>
        </Paper>

        <Stack spacing={2}>
          {terms.map((term) => (
            <GlossaryEntry key={term.id} term={term} />
          ))}
        </Stack>
      </Stack>
    </Box>
  );
}
