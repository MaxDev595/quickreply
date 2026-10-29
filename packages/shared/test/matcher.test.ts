import { describe, expect, it } from 'vitest';
import { createMatcher } from '../src/matcher';
import { createSnippet } from '../src/library';
import type { Snippet } from '../src/types';

const snip = (shortcut: string, content = `<${shortcut}>`, enabled = true): Snippet =>
  createSnippet({ name: shortcut, shortcut, content, enabled }, 0, shortcut);

describe('createMatcher (instant mode)', () => {
  const m = createMatcher([snip('/hello'), snip('/hi'), snip('/hire'), snip('brb'), snip('/off', 'x', false)], 'instant');

  it('expands a shortcut as soon as it is typed', () => {
    expect(m.match('Hey /hello')?.snippet.shortcut).toBe('/hello');
    expect(m.match('/hello')).toMatchObject({ removeLength: 6, trailing: '' });
  });

  it('does not expand inside a word or URL', () => {
    expect(m.match('example.com/hello')).toBeNull();
    expect(m.match('xbrb')).toBeNull();
  });

  it('expands at the start of a line and after punctuation', () => {
    expect(m.match('line one\nbrb')?.snippet.shortcut).toBe('brb');
    expect(m.match('(/hello')?.snippet.shortcut).toBe('/hello');
  });

  it('waits for a delimiter when a shortcut is a prefix of another', () => {
    expect(m.match('/hi')).toBeNull();
    expect(m.match('/hi ')).toMatchObject({ removeLength: 4, trailing: ' ' });
    expect(m.match('/hire')?.snippet.shortcut).toBe('/hire');
  });

  it('ignores disabled snippets', () => {
    expect(m.match('/off')).toBeNull();
    expect(m.match('/off ')).toBeNull();
  });

  it('does not re-expand non-ambiguous shortcuts on a delimiter', () => {
    expect(m.match('/hello ')).toBeNull();
  });

  it('reports look-behind large enough for the longest shortcut plus delimiter', () => {
    expect(m.lookBehind).toBe('/hello'.length + 2);
  });
});

describe('createMatcher (delimiter mode)', () => {
  const m = createMatcher([snip('/hello'), snip('/hi')], 'delimiter');

  it('only expands after a delimiter and keeps it', () => {
    expect(m.match('/hello')).toBeNull();
    expect(m.match('/hello,')).toMatchObject({ removeLength: 7, trailing: ',' });
    expect(m.match('/hi ')?.snippet.shortcut).toBe('/hi');
  });

  it('does not treat / or ; as delimiters', () => {
    expect(m.match('/hello/')).toBeNull();
    expect(m.match('/hello;')).toBeNull();
  });
});

describe('createMatcher edge cases', () => {
  it('handles an empty library', () => {
    expect(createMatcher([], 'instant').match('/anything')).toBeNull();
  });

  it('prefers the longest shortcut', () => {
    const m = createMatcher([snip('/sig'), snip('//sig')], 'instant');
    expect(m.match('//sig')?.snippet.shortcut).toBe('//sig');
  });

  it('keeps the first snippet when shortcuts are duplicated', () => {
    const a = createSnippet({ name: 'a', shortcut: '/dup', content: 'A' }, 0, 'a');
    const b = createSnippet({ name: 'b', shortcut: '/dup', content: 'B' }, 0, 'b');
    expect(createMatcher([a, b], 'instant').match('/dup')?.snippet.id).toBe('a');
  });
});
