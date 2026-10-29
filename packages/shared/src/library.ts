import type { Folder, Snippet, UsageStats } from './types';

export function createId(): string {
  return crypto.randomUUID();
}

export interface SnippetDraft {
  name: string;
  shortcut: string;
  content: string;
  folderId?: string | null;
  favorite?: boolean;
  enabled?: boolean;
}

export function createSnippet(draft: SnippetDraft, now = Date.now(), id = createId()): Snippet {
  return {
    id,
    name: draft.name.trim() || 'Untitled snippet',
    shortcut: draft.shortcut,
    content: draft.content,
    folderId: draft.folderId ?? null,
    favorite: draft.favorite ?? false,
    enabled: draft.enabled ?? true,
    createdAt: now,
    updatedAt: now,
  };
}

export function createFolder(name: string, now = Date.now(), id = createId()): Folder {
  return { id, name: name.trim(), createdAt: now };
}

export type SnippetSort = 'updated' | 'name' | 'shortcut' | 'most-used';

export function filterSnippets(snippets: readonly Snippet[], query: string): Snippet[] {
  const q = query.trim().toLowerCase();
  if (!q) return [...snippets];
  return snippets.filter(
    (s) =>
      s.name.toLowerCase().includes(q) ||
      s.shortcut.toLowerCase().includes(q) ||
      s.content.toLowerCase().includes(q),
  );
}

export function sortSnippets(snippets: readonly Snippet[], sort: SnippetSort, usage: UsageStats = {}): Snippet[] {
  const list = [...snippets];
  switch (sort) {
    case 'name':
      return list.sort((a, b) => a.name.localeCompare(b.name));
    case 'shortcut':
      return list.sort((a, b) => a.shortcut.localeCompare(b.shortcut));
    case 'most-used':
      return list.sort((a, b) => (usage[b.id]?.count ?? 0) - (usage[a.id]?.count ?? 0) || b.updatedAt - a.updatedAt);
    case 'updated':
      return list.sort((a, b) => b.updatedAt - a.updatedAt);
  }
}

/** Snippets used at least once, most recent first. */
export function recentlyUsed(snippets: readonly Snippet[], usage: UsageStats, limit = 20): Snippet[] {
  return snippets
    .filter((s) => usage[s.id])
    .sort((a, b) => (usage[b.id]?.lastUsedAt ?? 0) - (usage[a.id]?.lastUsedAt ?? 0))
    .slice(0, limit);
}

/** Plain one-line preview, used in lists. */
export function previewText(content: string, max = 90): string {
  const flat = content.replace(/\s+/g, ' ').trim();
  return flat.length > max ? `${flat.slice(0, max - 1)}…` : flat;
}
