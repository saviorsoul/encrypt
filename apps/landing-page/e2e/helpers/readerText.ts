const READER_IGNORED_SELECTOR = [
  '[aria-hidden="true"]',
  '.scroll-decorative',
  '.scroll-reader-heading',
].join(', ');

export function normalizeReaderText(text: string): string {
  return text
    .replace(/\u00a0/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

export function extractReaderText(root: ParentNode): string {
  const main = root.querySelector('main');
  if (!main) {
    return '';
  }

  const clone = main.cloneNode(true) as HTMLElement;
  clone.querySelectorAll(READER_IGNORED_SELECTOR).forEach((node) => {
    node.remove();
  });

  return normalizeReaderText(clone.innerText);
}

export function hasOrphanedLeadingSpaceOnWrappedLine(text: string): boolean {
  return /\n\s+\S/.test(text);
}
