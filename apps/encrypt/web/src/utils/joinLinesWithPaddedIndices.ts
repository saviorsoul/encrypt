/** Prefix `001  ` … `NNN  ` and join — only formatting applied to bulk step output. */
export function joinLinesWithPaddedIndices(values: string[]): string {
  return values
    .map((v, i) => `${String(i + 1).padStart(3, '0')}  ${v}`)
    .join('\n');
}
