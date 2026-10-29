import {
  createFolder,
  createSnippet,
  listPromptVariables,
  renderTemplate,
  uniqueShortcut,
  type Snippet,
  type SnippetDraft,
} from '@quickreply/shared';
import { pruneUsage, updateLibrary } from '../lib/storage';

/** All library mutations go through here so they share the read-modify-write path. */

export async function addSnippet(draft: SnippetDraft): Promise<Snippet> {
  const snippet = createSnippet(draft);
  await updateLibrary((lib) => ({ ...lib, snippets: [...lib.snippets, snippet] }));
  return snippet;
}

export async function saveSnippet(id: string, patch: Partial<Omit<Snippet, 'id' | 'createdAt'>>): Promise<void> {
  await updateLibrary((lib) => ({
    ...lib,
    snippets: lib.snippets.map((s) => (s.id === id ? { ...s, ...patch, updatedAt: Date.now() } : s)),
  }));
}

export async function deleteSnippet(id: string): Promise<void> {
  const lib = await updateLibrary((l) => ({ ...l, snippets: l.snippets.filter((s) => s.id !== id) }));
  await pruneUsage(new Set(lib.snippets.map((s) => s.id)));
}

export async function duplicateSnippet(id: string): Promise<Snippet | null> {
  let copy: Snippet | null = null;
  await updateLibrary((lib) => {
    const source = lib.snippets.find((s) => s.id === id);
    if (!source) return lib;
    const taken = new Set(lib.snippets.map((s) => s.shortcut));
    copy = createSnippet({
      name: `${source.name} (copy)`.slice(0, 80),
      shortcut: uniqueShortcut(source.shortcut, taken),
      content: source.content,
      folderId: source.folderId,
      enabled: source.enabled,
    });
    return { ...lib, snippets: [...lib.snippets, copy] };
  });
  return copy;
}

export async function addFolder(name: string): Promise<string> {
  const folder = createFolder(name);
  await updateLibrary((lib) => ({ ...lib, folders: [...lib.folders, folder] }));
  return folder.id;
}

export async function renameFolder(id: string, name: string): Promise<void> {
  await updateLibrary((lib) => ({
    ...lib,
    folders: lib.folders.map((f) => (f.id === id ? { ...f, name: name.trim() } : f)),
  }));
}

/** Deletes a folder; its snippets are kept and moved to "No folder". */
export async function deleteFolder(id: string): Promise<void> {
  await updateLibrary((lib) => ({
    folders: lib.folders.filter((f) => f.id !== id),
    snippets: lib.snippets.map((s) => (s.folderId === id ? { ...s, folderId: null } : s)),
  }));
}

/** Text placed on the clipboard by "Copy": dates rendered, custom fields kept as {name}. */
export async function copySnippet(snippet: Snippet): Promise<boolean> {
  const keep = Object.fromEntries(listPromptVariables(snippet.content).map((v) => [v, `{${v}}`]));
  const text = renderTemplate(snippet.content, { now: new Date(), values: keep, clipboard: '' });
  try {
    await navigator.clipboard.writeText(text);
    return true;
  } catch {
    return false;
  }
}

export function openDashboard(hash = ''): void {
  const url = chrome.runtime.getURL(`dashboard.html${hash}`);
  chrome.tabs.create({ url }).catch(() => window.open(url, '_blank'));
}
