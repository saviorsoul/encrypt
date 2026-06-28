import type { GlossaryTermId } from '@/utils/glossaryTerms.ts';

export const GLOSSARY_PATH = '/glossary';

export function glossaryHref(termId?: GlossaryTermId): string {
  return termId ? `${GLOSSARY_PATH}#${termId}` : GLOSSARY_PATH;
}
