/**
 * Read the current page selection as plain text with block line breaks preserved
 * (similar to copying as text/plain from HTML with <p> tags).
 *
 * Injected into the active tab via chrome.scripting.executeScript — must remain
 * self-contained (no imports).
 */
export function readFormattedSelectionText(): string {
  const BLOCK_TAGS = new Set([
    'ADDRESS',
    'ARTICLE',
    'ASIDE',
    'BLOCKQUOTE',
    'DD',
    'DIV',
    'DL',
    'DT',
    'FIELDSET',
    'FIGCAPTION',
    'FIGURE',
    'FOOTER',
    'FORM',
    'H1',
    'H2',
    'H3',
    'H4',
    'H5',
    'H6',
    'HEADER',
    'HR',
    'LI',
    'MAIN',
    'NAV',
    'OL',
    'P',
    'PRE',
    'SECTION',
    'TABLE',
    'TD',
    'TH',
    'TR',
    'UL',
  ]);

  function normalizePlainText(text: string): string {
    return text
      .replace(/\r\n/g, '\n')
      .replace(/\n{3,}/g, '\n\n')
      .trimEnd();
  }

  function serializeTextNode(
    text: string,
    preserveWhitespace: boolean,
  ): string {
    if (/^\s*$/.test(text)) {
      return '';
    }
    if (preserveWhitespace) {
      return text;
    }
    return text.replace(/[ \t\f\v]+/g, ' ');
  }

  function serializeNode(node: Node, preserveWhitespace: boolean): string {
    if (node.nodeType === Node.TEXT_NODE) {
      return serializeTextNode(node.textContent ?? '', preserveWhitespace);
    }
    if (node.nodeType !== Node.ELEMENT_NODE) {
      return '';
    }

    const el = node as Element;
    const tag = el.tagName;
    if (tag === 'BR') {
      return '\n';
    }
    if (tag === 'HR') {
      return '\n\n';
    }

    const keepWhitespace = preserveWhitespace || tag === 'PRE';

    let inner = '';
    const children = el.childNodes;
    for (let i = 0; i < children.length; i += 1) {
      inner += serializeNode(children[i]!, keepWhitespace);
    }

    if (BLOCK_TAGS.has(tag)) {
      const trimmed = inner.trim();
      if (!trimmed) {
        return '';
      }
      return `${trimmed}\n\n`;
    }

    return inner;
  }

  function serializeRoot(root: ParentNode): string {
    let text = '';
    const children = root.childNodes;
    for (let i = 0; i < children.length; i += 1) {
      text += serializeNode(children[i]!, false);
    }
    return text;
  }

  const selection = window.getSelection();
  if (!selection || selection.rangeCount === 0) {
    return '';
  }

  const range = selection.getRangeAt(0);
  if (range.collapsed) {
    return '';
  }

  const fromFragment = normalizePlainText(serializeRoot(range.cloneContents()));
  if (fromFragment) {
    return fromFragment;
  }

  return normalizePlainText(selection.toString());
}
