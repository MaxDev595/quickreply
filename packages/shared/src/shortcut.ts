import { LIMITS } from './constants';
import type { Snippet } from './types';

export type ShortcutError = 'empty' | 'too-short' | 'too-long' | 'whitespace' | 'braces' | 'duplicate';

export const SHORTCUT_ERROR_MESSAGES: Record<ShortcutError, string> = {
  empty: 'Shortcut is required.',
  'too-short': `Shortcut must be at least ${LIMITS.shortcutMin} characters.`,
  'too-long': `Shortcut must be at most ${LIMITS.shortcutMax} characters.`,
  whitespace: 'Shortcut cannot contain spaces.',
  braces: 'Shortcut cannot contain { or }.',
  duplicate: 'Another snippet already uses this shortcut.',
};

/**
 * Validates a shortcut. Returns `null` when valid.
 * `excludeId` lets the editor ignore the snippet being edited.
 */
export function validateShortcut(
  shortcut: string,
  snippets: readonly Pick<Snippet, 'id' | 'shortcut'>[],
  excludeId?: string,
): ShortcutError | null {
  if (shortcut.length === 0) return 'empty';
  if (/\s/.test(shortcut)) return 'whitespace';
  if (/[{}]/.test(shortcut)) return 'braces';
  if ([...shortcut].length < LIMITS.shortcutMin) return 'too-short';
  if ([...shortcut].length > LIMITS.shortcutMax) return 'too-long';
  if (snippets.some((s) => s.id !== excludeId && s.shortcut === shortcut)) return 'duplicate';
  return null;
}

/** Finds a free shortcut by appending a numeric suffix: `/hello` → `/hello2`. */
export function uniqueShortcut(base: string, taken: ReadonlySet<string>): string {
  if (!taken.has(base)) return base;
  const trimmed = base.slice(0, LIMITS.shortcutMax - 3);
  for (let i = 2; i < 1000; i++) {
    const candidate = `${trimmed}${i}`;
    if (!taken.has(candidate)) return candidate;
  }
  throw new Error('Could not find a free shortcut');
}
