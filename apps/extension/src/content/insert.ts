/**
 * Replacing the typed shortcut with the expansion.
 *
 * Primary path: `document.execCommand('insertText')`. It keeps native undo,
 * fires real `beforeinput`/`input` events, and therefore works with React,
 * Vue, ProseMirror, Lexical, Draft.js and Gmail's composer. Content is always
 * inserted as plain text — never via innerHTML.
 */

export interface FieldTarget {
  el: HTMLInputElement | HTMLTextAreaElement;
  start: number;
  end: number;
}

function nativeValueSetter(el: HTMLInputElement | HTMLTextAreaElement): ((v: string) => void) | undefined {
  const proto = el instanceof HTMLTextAreaElement ? HTMLTextAreaElement.prototype : HTMLInputElement.prototype;
  return Object.getOwnPropertyDescriptor(proto, 'value')?.set;
}

export function replaceInField({ el, start, end }: FieldTarget, rawText: string): boolean {
  // Single-line inputs can't hold line breaks; keep the words separated.
  const text = el instanceof HTMLInputElement ? rawText.replace(/\r?\n/g, ' ') : rawText;
  const before = el.value;
  if (document.activeElement !== el && el.getRootNode() === document) el.focus();
  el.setSelectionRange(start, end);

  let ok: boolean;
  try {
    ok = text.length > 0 ? document.execCommand('insertText', false, text) : document.execCommand('delete');
  } catch {
    ok = false;
  }
  const expected = before.slice(0, start) + text + before.slice(end);
  if (ok && el.value === expected) return true;

  // Fallback for pages that block execCommand: native setter so React notices the change.
  const setter = nativeValueSetter(el);
  if (!setter) return false;
  setter.call(el, expected);
  const caret = start + text.length;
  el.setSelectionRange(caret, caret);
  el.dispatchEvent(new InputEvent('input', { bubbles: true, composed: true, inputType: 'insertText', data: text }));
  el.dispatchEvent(new Event('change', { bubbles: true }));
  return el.value === expected;
}

/**
 * Extends a collapsed selection backwards by `length` characters and checks
 * that it covers exactly `expected`. Returns the covering range or null.
 */
export function selectBackwards(selection: Selection, expected: string): Range | null {
  if (selection.rangeCount === 0 || !selection.isCollapsed) return null;
  const anchor = selection.getRangeAt(0).cloneRange();
  for (let i = 0; i < expected.length; i++) selection.modify('extend', 'backward', 'character');
  if (selection.toString() === expected) return selection.getRangeAt(0).cloneRange();
  // Grapheme clusters (emoji etc.) can make character steps differ; restore the caret.
  selection.removeAllRanges();
  selection.addRange(anchor);
  return null;
}

/** Inserts plain multi-line text over the current selection in a contenteditable. */
export function insertRichText(text: string): boolean {
  const lines = text.replace(/\r\n?/g, '\n').split('\n');
  let ok = true;
  if (lines[0] === '') ok = document.execCommand('delete');
  lines.forEach((line, i) => {
    if (i > 0) ok = document.execCommand('insertLineBreak') && ok;
    if (line) ok = document.execCommand('insertText', false, line) && ok;
  });
  return ok;
}
