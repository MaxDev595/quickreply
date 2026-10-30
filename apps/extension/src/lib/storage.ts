import {
  DEFAULT_SETTINGS,
  SCHEMA_VERSION,
  STORAGE_KEYS,
  withinSnippetLimit,
  type Folder,
  type LibraryData,
  type Settings,
  type Snippet,
  type UsageStats,
} from '@quickreply/shared';
import { currentSnippetLimit } from './billing';

export interface AppState {
  snippets: Snippet[];
  folders: Folder[];
  settings: Settings;
  usage: UsageStats;
}

const area = (): chrome.storage.StorageArea => chrome.storage.local;

function asArray<T>(value: unknown): T[] {
  return Array.isArray(value) ? (value as T[]) : [];
}

export function normalizeSettings(value: unknown): Settings {
  const v = (typeof value === 'object' && value !== null ? value : {}) as Partial<Settings>;
  return {
    enabled: typeof v.enabled === 'boolean' ? v.enabled : DEFAULT_SETTINGS.enabled,
    excludedSites: Array.isArray(v.excludedSites)
      ? v.excludedSites.filter((s): s is string => typeof s === 'string')
      : DEFAULT_SETTINGS.excludedSites,
    triggerMode: v.triggerMode === 'delimiter' ? 'delimiter' : 'instant',
    defaultPrefix: typeof v.defaultPrefix === 'string' ? v.defaultPrefix : DEFAULT_SETTINGS.defaultPrefix,
    theme: v.theme === 'light' || v.theme === 'dark' ? v.theme : 'system',
    clipboardEnabled: v.clipboardEnabled === true,
  };
}

function normalizeUsage(value: unknown): UsageStats {
  return typeof value === 'object' && value !== null && !Array.isArray(value) ? (value as UsageStats) : {};
}

export async function loadState(): Promise<AppState> {
  const raw = await area().get(Object.values(STORAGE_KEYS));
  return {
    snippets: asArray<Snippet>(raw[STORAGE_KEYS.snippets]),
    folders: asArray<Folder>(raw[STORAGE_KEYS.folders]),
    settings: normalizeSettings(raw[STORAGE_KEYS.settings]),
    usage: normalizeUsage(raw[STORAGE_KEYS.usage]),
  };
}

/** Thrown when a change would grow a Free library past its snippet limit. */
export class SnippetLimitError extends Error {
  constructor(
    readonly limit: number,
    readonly current: number,
  ) {
    super(`The Free plan includes up to ${limit} snippets.`);
    this.name = 'SnippetLimitError';
  }
}

/**
 * Read-modify-write on the latest stored library, so two open extension pages
 * (popup + dashboard) don't overwrite each other's edits with stale copies.
 */
export async function updateLibrary(fn: (lib: LibraryData) => LibraryData): Promise<LibraryData> {
  const { snippets, folders } = await loadState();
  const next = fn({ snippets, folders });
  if (next.snippets.length > snippets.length) {
    const limit = await currentSnippetLimit();
    if (!withinSnippetLimit(snippets.length, next.snippets.length, limit)) throw new SnippetLimitError(limit, snippets.length);
  }
  await area().set({
    [STORAGE_KEYS.snippets]: next.snippets,
    [STORAGE_KEYS.folders]: next.folders,
    [STORAGE_KEYS.schemaVersion]: SCHEMA_VERSION,
  });
  return next;
}

export async function updateSettings(patch: Partial<Settings>): Promise<Settings> {
  const { settings } = await loadState();
  const next = normalizeSettings({ ...settings, ...patch });
  await area().set({ [STORAGE_KEYS.settings]: next });
  return next;
}

export async function recordUsage(snippetId: string, now = Date.now()): Promise<void> {
  const raw = await area().get(STORAGE_KEYS.usage);
  const usage = normalizeUsage(raw[STORAGE_KEYS.usage]);
  const prev = usage[snippetId];
  usage[snippetId] = { count: (prev?.count ?? 0) + 1, lastUsedAt: now };
  await area().set({ [STORAGE_KEYS.usage]: usage });
}

export async function pruneUsage(validIds: ReadonlySet<string>): Promise<void> {
  const raw = await area().get(STORAGE_KEYS.usage);
  const usage = normalizeUsage(raw[STORAGE_KEYS.usage]);
  const next = Object.fromEntries(Object.entries(usage).filter(([id]) => validIds.has(id)));
  await area().set({ [STORAGE_KEYS.usage]: next });
}

/** Calls `onChange` with a fresh state whenever any QuickReply key changes. */
export function subscribe(onChange: (state: AppState) => void): () => void {
  const keys = new Set<string>(Object.values(STORAGE_KEYS));
  const listener = (changes: Record<string, chrome.storage.StorageChange>, areaName: string) => {
    if (areaName !== 'local' || !Object.keys(changes).some((k) => keys.has(k))) return;
    loadState().then(onChange, () => undefined);
  };
  chrome.storage.onChanged.addListener(listener);
  return () => chrome.storage.onChanged.removeListener(listener);
}
