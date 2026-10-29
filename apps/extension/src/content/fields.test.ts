import { describe, expect, it } from 'vitest';
import { normalizeSettings } from '../lib/storage';
import { isGetPageInfoRequest, isPageInfo } from '../lib/messages';
import { parseHash, toHash } from '../dashboard/route';
import { resolveEditable } from './fields';
import { fieldTextBeforeCaret, richTextBeforeCaret } from './textAccess';

function html(markup: string): HTMLElement {
  // eslint-disable-next-line no-restricted-properties -- static test fixture markup
  document.body.innerHTML = markup;
  return document.body;
}

describe('resolveEditable', () => {
  it('accepts text-like inputs, textareas and contenteditable', () => {
    html('<input id="a"><input id="b" type="email"><textarea id="c"></textarea><div id="d" contenteditable="true"><b id="e">x</b></div>');
    for (const id of ['a', 'b', 'c']) expect(resolveEditable(document.getElementById(id))?.kind).toBe('field');
    // jsdom has no isContentEditable; emulate the browser property.
    for (const id of ['d', 'e']) Object.defineProperty(document.getElementById(id), 'isContentEditable', { value: true });
    const rich = resolveEditable(document.getElementById('e'));
    expect(rich?.kind).toBe('rich');
    expect(rich?.el.id).toBe('d');
  });

  it.each([
    '<input id="x" type="password">',
    '<input id="x" type="number">',
    '<input id="x" autocomplete="cc-number">',
    '<input id="x" autocomplete="one-time-code">',
    '<input id="x" name="card_number">',
    '<input id="x" placeholder="Enter your password">',
    '<input id="x" aria-label="CVV">',
    '<input id="x" readonly>',
    '<textarea id="x" disabled></textarea>',
    '<div data-quickreply-ignore><input id="x"></div>',
  ])('rejects sensitive or locked field %s', (markup) => {
    html(markup);
    expect(resolveEditable(document.getElementById('x'))).toBeNull();
  });

  it('does not treat normal fields with similar words as sensitive', () => {
    html('<input id="x" placeholder="Your opinion"><input id="y" name="passenger_name"><input id="z" placeholder="Footprint">');
    for (const id of ['x', 'y', 'z']) expect(resolveEditable(document.getElementById(id))).not.toBeNull();
  });
});

describe('text before caret', () => {
  it('reads only the requested number of characters from a field', () => {
    html('<textarea id="t"></textarea>');
    const t = document.getElementById('t') as HTMLTextAreaElement;
    t.value = 'hello world /sig';
    t.setSelectionRange(16, 16);
    expect(fieldTextBeforeCaret(t, 5)).toBe(' /sig');
    t.setSelectionRange(0, 5);
    expect(fieldTextBeforeCaret(t, 5)).toBeNull();
  });

  it('stops at block boundaries in rich text', () => {
    const body = html('<div id="host"><div>line1</div><div id="l2">/hi</div></div>');
    const host = body.querySelector('#host') as HTMLElement;
    const text = body.querySelector('#l2')?.firstChild as Text;
    const sel = window.getSelection();
    sel?.removeAllRanges();
    const r = document.createRange();
    r.setStart(text, 3);
    sel?.addRange(r);
    expect(richTextBeforeCaret(host, sel, 10)).toBe('\n/hi');
  });

  it('joins inline nodes on the same line', () => {
    const body = html('<div id="host">Hi <b>there</b> /x</div>');
    const host = body.querySelector('#host') as HTMLElement;
    const last = host.lastChild as Text;
    const sel = window.getSelection();
    sel?.removeAllRanges();
    const r = document.createRange();
    r.setStart(last, last.data.length);
    sel?.addRange(r);
    expect(richTextBeforeCaret(host, sel, 9)).toBe(' there /x');
  });
});

describe('storage and messaging guards', () => {
  it('normalizes corrupted settings', () => {
    expect(normalizeSettings({ enabled: 'yes', excludedSites: [1, 'a.com'], triggerMode: 'weird', theme: 'neon' })).toEqual({
      enabled: true,
      excludedSites: ['a.com'],
      triggerMode: 'instant',
      defaultPrefix: '/',
      theme: 'system',
      clipboardEnabled: false,
    });
    expect(normalizeSettings(null).enabled).toBe(true);
  });

  it('validates runtime messages', () => {
    expect(isGetPageInfoRequest({ type: 'quickreply/get-page-info' })).toBe(true);
    expect(isGetPageInfoRequest({ type: 'other' })).toBe(false);
    expect(isGetPageInfoRequest(null)).toBe(false);
    expect(isPageInfo({ hostname: 'a.com' })).toBe(true);
    expect(isPageInfo({ hostname: 1 })).toBe(false);
  });

  it('round-trips dashboard routes', () => {
    for (const hash of ['#/all', '#/favorites?new=1', '#/folder/abc?s=123', '#/settings', '#/recent?s=x']) {
      expect(toHash(parseHash(hash))).toBe(hash);
    }
    expect(parseHash('#/unknown').view).toEqual({ kind: 'all' });
  });
});
