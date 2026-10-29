import { describe, expect, it } from 'vitest';
import { isSiteExcluded, normalizeSiteInput } from '../src/sites';
import { uniqueShortcut, validateShortcut } from '../src/shortcut';
import { createSnippet, filterSnippets, previewText, recentlyUsed, sortSnippets } from '../src/library';

describe('sites', () => {
  it.each([
    ['https://mail.google.com/mail/u/0', 'mail.google.com'],
    ['*.Example.com', 'example.com'],
    ['www.example.com', 'example.com'],
    ['example.com/path', 'example.com'],
    ['localhost', 'localhost'],
    ['127.0.0.1', '127.0.0.1'],
  ])('normalizes %s', (input, expected) => {
    expect(normalizeSiteInput(input)).toBe(expected);
  });

  it.each(['', '   ', 'not a host', 'nodot', 'http://'])('rejects %j', (input) => {
    expect(normalizeSiteInput(input)).toBeNull();
  });

  it('excludes subdomains', () => {
    expect(isSiteExcluded('mail.google.com', ['google.com'])).toBe(true);
    expect(isSiteExcluded('www.example.com', ['example.com'])).toBe(true);
    expect(isSiteExcluded('notexample.com', ['example.com'])).toBe(false);
  });
});

describe('shortcuts', () => {
  const existing = [{ id: '1', shortcut: '/hello' }];
  it('validates', () => {
    expect(validateShortcut('/hello', existing)).toBe('duplicate');
    expect(validateShortcut('/hello', existing, '1')).toBeNull();
    expect(validateShortcut('', [])).toBe('empty');
    expect(validateShortcut('/', [])).toBe('too-short');
    expect(validateShortcut('/a b', [])).toBe('whitespace');
    expect(validateShortcut('/{x}', [])).toBe('braces');
    expect(validateShortcut('/'.padEnd(33, 'a'), [])).toBe('too-long');
  });

  it('generates unique shortcuts', () => {
    expect(uniqueShortcut('/a', new Set(['/a', '/a2']))).toBe('/a3');
    expect(uniqueShortcut('/b', new Set(['/a']))).toBe('/b');
  });
});

describe('library helpers', () => {
  const a = createSnippet({ name: 'Alpha', shortcut: '/zz', content: 'Pricing info' }, 10, 'a');
  const b = createSnippet({ name: 'Beta', shortcut: '/aa', content: 'Hello' }, 20, 'b');

  it('filters by name, shortcut and content', () => {
    expect(filterSnippets([a, b], 'pricing').map((s) => s.id)).toEqual(['a']);
    expect(filterSnippets([a, b], '/AA').map((s) => s.id)).toEqual(['b']);
    expect(filterSnippets([a, b], ' ')).toHaveLength(2);
  });

  it('sorts', () => {
    expect(sortSnippets([a, b], 'updated').map((s) => s.id)).toEqual(['b', 'a']);
    expect(sortSnippets([b, a], 'name').map((s) => s.id)).toEqual(['a', 'b']);
    expect(sortSnippets([a, b], 'shortcut').map((s) => s.id)).toEqual(['b', 'a']);
    expect(sortSnippets([b, a], 'most-used', { a: { count: 3, lastUsedAt: 1 } }).map((s) => s.id)).toEqual(['a', 'b']);
  });

  it('lists recently used', () => {
    const usage = { a: { count: 1, lastUsedAt: 5 }, b: { count: 1, lastUsedAt: 9 } };
    expect(recentlyUsed([a, b], usage).map((s) => s.id)).toEqual(['b', 'a']);
    expect(recentlyUsed([a, b], {})).toEqual([]);
  });

  it('builds previews', () => {
    expect(previewText('a\n\nb   c')).toBe('a b c');
    expect(previewText('x'.repeat(100), 10)).toHaveLength(10);
  });
});
