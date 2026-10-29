import { DELIMITERS } from './constants';
import type { Snippet, TriggerMode } from './types';

export interface MatchResult {
  snippet: Snippet;
  /** Number of UTF-16 code units before the caret to replace. */
  removeLength: number;
  /** Delimiter that completed the shortcut; re-inserted after the expansion. */
  trailing: string;
}

export interface Matcher {
  /** How many characters before the caret the caller needs to provide. */
  readonly lookBehind: number;
  match(textBeforeCaret: string): MatchResult | null;
}

const WORD_CHAR = /[\p{L}\p{N}_]/u;

/** A shortcut only fires at a word boundary: `site.com/hello` must not expand `/hello`. */
function hasBoundaryBefore(text: string, start: number): boolean {
  if (start === 0) return true;
  const prev = text[start - 1] ?? '';
  return !WORD_CHAR.test(prev);
}

/**
 * Builds an immutable matcher over the enabled snippets.
 *
 * Rules:
 * - The longest matching shortcut wins.
 * - In `instant` mode a shortcut fires as soon as its last character is typed,
 *   unless it is a prefix of another shortcut (`/hi` vs `/hire`). Such
 *   ambiguous shortcuts wait for a delimiter (space or punctuation).
 * - In `delimiter` mode every shortcut waits for a delimiter.
 */
export function createMatcher(snippets: readonly Snippet[], mode: TriggerMode): Matcher {
  const byShortcut = new Map<string, Snippet>();
  for (const s of snippets) {
    if (s.enabled && s.shortcut.length > 0 && !byShortcut.has(s.shortcut)) byShortcut.set(s.shortcut, s);
  }
  const shortcuts = [...byShortcut.keys()];
  const lengths = [...new Set(shortcuts.map((s) => s.length))].sort((a, b) => b - a);
  const ambiguous = new Set(
    shortcuts.filter((a) => shortcuts.some((b) => b !== a && b.startsWith(a))),
  );
  const maxLen = lengths[0] ?? 0;

  function longestEndingAt(text: string): Snippet | null {
    for (const len of lengths) {
      if (len > text.length) continue;
      const start = text.length - len;
      const candidate = byShortcut.get(text.slice(start));
      if (candidate && hasBoundaryBefore(text, start)) return candidate;
    }
    return null;
  }

  return {
    lookBehind: maxLen + 2,
    match(textBeforeCaret) {
      if (maxLen === 0 || textBeforeCaret.length === 0) return null;

      if (mode === 'instant') {
        const direct = longestEndingAt(textBeforeCaret);
        if (direct && !ambiguous.has(direct.shortcut)) {
          return { snippet: direct, removeLength: direct.shortcut.length, trailing: '' };
        }
      }

      const last = textBeforeCaret.slice(-1);
      if (!DELIMITERS.has(last)) return null;
      const before = textBeforeCaret.slice(0, -1);
      const delimited = longestEndingAt(before);
      if (!delimited) return null;
      if (mode === 'instant' && !ambiguous.has(delimited.shortcut)) return null;
      return { snippet: delimited, removeLength: delimited.shortcut.length + 1, trailing: last };
    },
  };
}
