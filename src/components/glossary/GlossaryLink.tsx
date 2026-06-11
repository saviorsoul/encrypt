import React from 'react';
import Link from '@mui/material/Link';
import { Link as RouterLink } from 'react-router-dom';
import { glossaryHref } from '@/utils/glossaryPaths.ts';
import type { GlossaryTermId } from '@/utils/glossaryTerms.ts';
import { getGlossaryTerm } from '@/utils/glossaryTerms.ts';

type GlossaryLinkProps = {
  termId: GlossaryTermId;
  /** Defaults to the term title from the glossary. */
  children?: React.ReactNode;
};

export function GlossaryLink({ termId, children }: GlossaryLinkProps) {
  const term = getGlossaryTerm(termId);
  const label = children ?? term?.title ?? termId;

  return (
    <Link
      component={RouterLink}
      to={glossaryHref(termId)}
      underline="hover"
      color="primary"
      sx={{ fontWeight: 'inherit' }}
    >
      {label}
    </Link>
  );
}
