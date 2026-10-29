/** A saved text template that expands when its shortcut is typed. */
export interface Snippet {
  id: string;
  name: string;
  shortcut: string;
  content: string;
  /** `null` means the snippet lives at the top level (no folder). */
  folderId: string | null;
  favorite: boolean;
  enabled: boolean;
  /** Epoch milliseconds. */
  createdAt: number;
  /** Epoch milliseconds. */
  updatedAt: number;
}

export interface Folder {
  id: string;
  name: string;
  createdAt: number;
}

export type TriggerMode = 'instant' | 'delimiter';
export type ThemePreference = 'light' | 'dark' | 'system';

export interface Settings {
  /** Global on/off switch. */
  enabled: boolean;
  /** Hostnames where expansion is disabled. Subdomains are included. */
  excludedSites: string[];
  triggerMode: TriggerMode;
  /** Prefix suggested for new snippets, e.g. "/" or ";". May be empty. */
  defaultPrefix: string;
  theme: ThemePreference;
  /** `{clipboard}` only works when this is on and the optional permission is granted. */
  clipboardEnabled: boolean;
}

/** Local-only usage statistics, keyed by snippet id. Never leaves the device. */
export interface UsageEntry {
  count: number;
  lastUsedAt: number;
}
export type UsageStats = Record<string, UsageEntry>;

export interface LibraryData {
  snippets: Snippet[];
  folders: Folder[];
}

export const EXPORT_FORMAT = 'quickreply-backup' as const;

export interface ExportFile {
  format: typeof EXPORT_FORMAT;
  version: 1;
  exportedAt: string;
  snippets: Snippet[];
  folders: Folder[];
}
