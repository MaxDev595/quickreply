import type { Settings } from './types';

export const STORAGE_KEYS = {
  snippets: 'qr.snippets',
  folders: 'qr.folders',
  settings: 'qr.settings',
  usage: 'qr.usage',
  schemaVersion: 'qr.schemaVersion',
} as const;

export const SCHEMA_VERSION = 1;

export const LIMITS = {
  nameMax: 80,
  shortcutMin: 2,
  shortcutMax: 32,
  contentMax: 20_000,
  folderNameMax: 40,
  maxSnippets: 5_000,
  maxFolders: 200,
  importFileMaxBytes: 5 * 1024 * 1024,
  variableValueMax: 2_000,
} as const;

export const PREFIX_OPTIONS = ['/', ';', '//', '!', ''] as const;

export const DEFAULT_SETTINGS: Settings = {
  enabled: true,
  excludedSites: [],
  triggerMode: 'instant',
  defaultPrefix: '/',
  theme: 'system',
  clipboardEnabled: false,
};

/**
 * Characters that complete a shortcut in "delimiter" mode (and for shortcuts
 * that are a prefix of a longer one). `/` and `;` are deliberately excluded
 * because they are common shortcut prefixes.
 */
export const DELIMITERS = new Set([' ', ' ', '.', ',', '!', '?', ':', ')', ']']);
