import { LIMITS } from './constants';
import { createId } from './library';
import { uniqueShortcut, validateShortcut } from './shortcut';
import { EXPORT_FORMAT, type ExportFile, type Folder, type LibraryData, type Snippet } from './types';

export function createExport(data: LibraryData, now = new Date()): ExportFile {
  return {
    format: EXPORT_FORMAT,
    version: 1,
    exportedAt: now.toISOString(),
    snippets: data.snippets.map((s) => ({ ...s })),
    folders: data.folders.map((f) => ({ ...f })),
  };
}

export function exportFileName(now = new Date()): string {
  return `quickreply-backup-${now.toISOString().slice(0, 10)}.json`;
}

export interface ParsedImport {
  data: LibraryData;
  /** Human-readable reasons why individual items were skipped. */
  warnings: string[];
}

export type ImportParseResult = { ok: true; value: ParsedImport } | { ok: false; error: string };

type UnknownRecord = Record<string, unknown>;
const isRecord = (v: unknown): v is UnknownRecord => typeof v === 'object' && v !== null && !Array.isArray(v);
const str = (v: unknown): string | undefined => (typeof v === 'string' ? v : undefined);
const num = (v: unknown): number | undefined => (typeof v === 'number' && Number.isFinite(v) && v >= 0 ? v : undefined);
const bool = (v: unknown): boolean | undefined => (typeof v === 'boolean' ? v : undefined);
const ID_RE = /^[A-Za-z0-9_-]{1,64}$/;

/**
 * Parses and validates an untrusted backup file. Never throws. Invalid items
 * are skipped with a warning; a structurally broken file is rejected.
 */
export function parseImport(text: string, now = Date.now()): ImportParseResult {
  if (text.length > LIMITS.importFileMaxBytes) return { ok: false, error: 'File is too large (max 5 MB).' };
  let raw: unknown;
  try {
    raw = JSON.parse(text);
  } catch {
    return { ok: false, error: 'This file is not valid JSON.' };
  }
  if (!isRecord(raw)) return { ok: false, error: 'Unrecognized file structure.' };
  if (raw.format !== undefined && raw.format !== EXPORT_FORMAT) {
    return { ok: false, error: 'This is not a QuickReply backup file.' };
  }
  if (raw.version !== undefined && raw.version !== 1) {
    return { ok: false, error: `Unsupported backup version: ${String(raw.version)}.` };
  }
  if (!Array.isArray(raw.snippets)) return { ok: false, error: 'The file has no "snippets" list.' };
  if (raw.snippets.length > LIMITS.maxSnippets) {
    return { ok: false, error: `Too many snippets (max ${LIMITS.maxSnippets}).` };
  }

  const warnings: string[] = [];
  const folders: Folder[] = [];
  const folderIds = new Set<string>();
  const rawFolders = Array.isArray(raw.folders) ? raw.folders.slice(0, LIMITS.maxFolders) : [];
  rawFolders.forEach((f, i) => {
    const id = isRecord(f) ? str(f.id) : undefined;
    const name = isRecord(f) ? str(f.name)?.trim() : undefined;
    if (!isRecord(f) || !id || !ID_RE.test(id) || !name || name.length > LIMITS.folderNameMax || folderIds.has(id)) {
      warnings.push(`Folder #${i + 1} was skipped: invalid or duplicate.`);
      return;
    }
    folderIds.add(id);
    folders.push({ id, name, createdAt: num(f.createdAt) ?? now });
  });

  const snippets: Snippet[] = [];
  const seenIds = new Set<string>();
  raw.snippets.forEach((s, i) => {
    const label = `Snippet #${i + 1}`;
    if (!isRecord(s)) {
      warnings.push(`${label} was skipped: not an object.`);
      return;
    }
    const shortcut = str(s.shortcut);
    const content = str(s.content);
    if (shortcut === undefined || content === undefined) {
      warnings.push(`${label} was skipped: missing shortcut or content.`);
      return;
    }
    const shortcutError = validateShortcut(shortcut, []);
    if (shortcutError) {
      warnings.push(`${label} was skipped: invalid shortcut "${shortcut.slice(0, 40)}".`);
      return;
    }
    if (content.length > LIMITS.contentMax) {
      warnings.push(`${label} was skipped: content is longer than ${LIMITS.contentMax} characters.`);
      return;
    }
    let id = str(s.id);
    if (!id || !ID_RE.test(id) || seenIds.has(id)) id = createId();
    seenIds.add(id);
    const folderId = str(s.folderId);
    const name = (str(s.name) ?? '').trim().slice(0, LIMITS.nameMax) || shortcut;
    const createdAt = num(s.createdAt) ?? now;
    snippets.push({
      id,
      name,
      shortcut,
      content,
      folderId: folderId && folderIds.has(folderId) ? folderId : null,
      favorite: bool(s.favorite) ?? false,
      enabled: bool(s.enabled) ?? true,
      createdAt,
      updatedAt: num(s.updatedAt) ?? createdAt,
    });
  });

  if (snippets.length === 0 && raw.snippets.length > 0) {
    return { ok: false, error: 'No valid snippets were found in this file.' };
  }
  return { ok: true, value: { data: { snippets, folders }, warnings } };
}

/** What to do when an imported shortcut already exists. */
export type ShortcutConflictStrategy = 'rename' | 'skip' | 'overwrite';

export interface MergeReport {
  added: number;
  renamed: number;
  skipped: number;
  overwritten: number;
  foldersAdded: number;
}

export interface MergeResult {
  data: LibraryData;
  report: MergeReport;
}

/**
 * Merges imported data into the existing library.
 * - Folder with the same name → reused. Folder id clash with a different name → new id.
 * - Snippet id clash → imported snippet gets a new id (existing data is never silently lost).
 * - Shortcut clash → resolved with `strategy`.
 */
export function mergeImport(
  existing: LibraryData,
  incoming: LibraryData,
  strategy: ShortcutConflictStrategy,
): MergeResult {
  const report: MergeReport = { added: 0, renamed: 0, skipped: 0, overwritten: 0, foldersAdded: 0 };
  const folders = existing.folders.map((f) => ({ ...f }));
  const folderMap = new Map<string, string>();
  const folderIds = new Set(folders.map((f) => f.id));

  for (const f of incoming.folders) {
    const sameName = folders.find((x) => x.name.toLowerCase() === f.name.toLowerCase());
    if (sameName) {
      folderMap.set(f.id, sameName.id);
      continue;
    }
    const id = folderIds.has(f.id) ? createId() : f.id;
    folders.push({ ...f, id });
    folderIds.add(id);
    folderMap.set(f.id, id);
    report.foldersAdded++;
  }

  const snippets = existing.snippets.map((s) => ({ ...s }));
  const ids = new Set(snippets.map((s) => s.id));
  const shortcuts = new Set(snippets.map((s) => s.shortcut));

  for (const original of incoming.snippets) {
    const s: Snippet = {
      ...original,
      folderId: original.folderId ? (folderMap.get(original.folderId) ?? null) : null,
    };
    if (shortcuts.has(s.shortcut)) {
      if (strategy === 'skip') {
        report.skipped++;
        continue;
      }
      if (strategy === 'overwrite') {
        const idx = snippets.findIndex((x) => x.shortcut === s.shortcut);
        const target = snippets[idx];
        if (target) {
          snippets[idx] = { ...s, id: target.id, createdAt: target.createdAt };
          report.overwritten++;
        }
        continue;
      }
      s.shortcut = uniqueShortcut(s.shortcut, shortcuts);
      report.renamed++;
    }
    if (ids.has(s.id)) s.id = createId();
    ids.add(s.id);
    shortcuts.add(s.shortcut);
    snippets.push(s);
    report.added++;
  }

  return { data: { snippets, folders }, report };
}

/**
 * Restores a backup as the whole library. Duplicate shortcuts inside the
 * backup itself are renamed so the restored library is always valid.
 */
export function replaceWithImport(incoming: LibraryData): MergeResult {
  return mergeImport({ snippets: [], folders: [] }, incoming, 'rename');
}
