/** Reading the few characters before the caret. Nothing is stored or sent anywhere. */

const BLOCK_TAGS = new Set([
  'DIV', 'P', 'LI', 'UL', 'OL', 'H1', 'H2', 'H3', 'H4', 'H5', 'H6', 'BLOCKQUOTE', 'PRE', 'TD', 'TH', 'TR',
  'TABLE', 'SECTION', 'ARTICLE', 'HEADER', 'FOOTER', 'FIGURE',
]);

export function getSelectionFor(root: Document | ShadowRoot): Selection | null {
  // Chrome exposes getSelection() on shadow roots; fall back to the document selection.
  const shadowGetSelection = (root as ShadowRoot & { getSelection?: () => Selection | null }).getSelection;
  if (root instanceof ShadowRoot && typeof shadowGetSelection === 'function') {
    return shadowGetSelection.call(root);
  }
  return document.getSelection();
}

export function fieldTextBeforeCaret(el: HTMLInputElement | HTMLTextAreaElement, n: number): string | null {
  const { selectionStart, selectionEnd } = el;
  if (selectionStart === null || selectionEnd === null || selectionStart !== selectionEnd) return null;
  return el.value.slice(Math.max(0, selectionStart - n), selectionStart);
}

function blockOf(node: Node, host: HTMLElement): Node {
  let cur: Node | null = node.parentNode;
  while (cur && cur !== host) {
    if (cur instanceof Element && BLOCK_TAGS.has(cur.tagName)) return cur;
    cur = cur.parentNode;
  }
  return host;
}

/**
 * Text before a collapsed caret inside a contenteditable host, limited to the
 * current line. A line/block boundary is reported as "\n" so shortcuts at the
 * start of a new paragraph still have a word boundary.
 */
export function richTextBeforeCaret(host: HTMLElement, selection: Selection | null, n: number): string | null {
  if (!selection || selection.rangeCount === 0 || !selection.isCollapsed) return null;
  const range = selection.getRangeAt(0);
  const { startContainer, startOffset } = range;
  if (!host.contains(startContainer)) return null;

  let text: string;
  let caretNode: Node;
  if (startContainer.nodeType === Node.TEXT_NODE) {
    text = (startContainer as Text).data.slice(0, startOffset);
    caretNode = startContainer;
  } else {
    // Caret between child nodes: start from the node just before it.
    const before = startContainer.childNodes[startOffset - 1];
    if (!before) return '\n';
    caretNode = before;
    if (before.nodeType === Node.TEXT_NODE) text = (before as Text).data;
    else if (before instanceof HTMLBRElement || (before instanceof Element && BLOCK_TAGS.has(before.tagName))) return '\n';
    else text = before.textContent ?? '';
  }
  if (text.length >= n) return text.slice(-n);

  const caretBlock = blockOf(caretNode, host);
  const walker = document.createTreeWalker(host, NodeFilter.SHOW_TEXT | NodeFilter.SHOW_ELEMENT);
  walker.currentNode = caretNode;
  let node = walker.previousNode();
  while (node && text.length < n) {
    if (node.nodeType === Node.ELEMENT_NODE) {
      if (node instanceof HTMLBRElement) return `\n${text}`.slice(-n);
    } else if (!caretNode.contains(node)) {
      if (blockOf(node, host) !== caretBlock) return `\n${text}`.slice(-n);
      text = (node as Text).data + text;
    }
    if (node === host) break;
    node = walker.previousNode();
  }
  return text.slice(-n);
}
