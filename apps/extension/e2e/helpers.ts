import { resolve } from 'node:path';
import { expect, type Page } from '@playwright/test';
import { DEFAULT_SETTINGS, STORAGE_KEYS, createSnippet, type Folder, type Settings, type Snippet, type SnippetDraft } from '@quickreply/shared';

export const HARNESS_PORT = 4789;
export const BASE = `http://127.0.0.1:${HARNESS_PORT}`;
/** Same server under a different hostname, for per-site exclusion tests. */
export const ALT_BASE = `http://localhost:${HARNESS_PORT}`;
export const STORE_FILE = resolve(import.meta.dirname, '../test-results/harness-store.json');

export function snippet(draft: SnippetDraft & { id?: string }): Snippet {
  return createSnippet(draft, Date.now(), draft.id);
}

export async function seed(data: { snippets?: Snippet[]; folders?: Folder[]; settings?: Partial<Settings> }): Promise<number> {
  const res = await fetch(`${BASE}/__reset`, {
    method: 'POST',
    body: JSON.stringify({
      [STORAGE_KEYS.snippets]: data.snippets ?? [],
      [STORAGE_KEYS.folders]: data.folders ?? [],
      [STORAGE_KEYS.settings]: { ...DEFAULT_SETTINGS, ...data.settings },
      [STORAGE_KEYS.usage]: {},
    }),
  });
  return ((await res.json()) as { version: number }).version;
}

export async function readStore(): Promise<Record<string, unknown>> {
  const res = await fetch(`${BASE}/__store`);
  return ((await res.json()) as { data: Record<string, unknown> }).data;
}

export async function storedSnippets(): Promise<Snippet[]> {
  return ((await readStore())[STORAGE_KEYS.snippets] as Snippet[] | undefined) ?? [];
}

export async function updateStoredSettings(patch: Partial<Settings>): Promise<number> {
  const current = ((await readStore())[STORAGE_KEYS.settings] as Settings | undefined) ?? DEFAULT_SETTINGS;
  const res = await fetch(`${BASE}/__store`, {
    method: 'POST',
    body: JSON.stringify({ set: { [STORAGE_KEYS.settings]: { ...current, ...patch } } }),
  });
  return ((await res.json()) as { version: number }).version;
}

/** Waits until the page loaded storage and is listening for changes. */
export async function waitForReady(page: Page): Promise<void> {
  await page.waitForFunction(() => {
    const w = window as unknown as { __qrEventsOpen?: boolean; __qrGets?: number; __qrPending?: number };
    return w.__qrEventsOpen === true && (w.__qrGets ?? 0) > 0 && w.__qrPending === 0;
  });
}

/** Waits until the page has processed storage change `version`. */
export async function waitForVersion(page: Page, version: number): Promise<void> {
  await page.waitForFunction(
    (v) => {
      const w = window as unknown as { __qrSeenVersion?: number; __qrPending?: number };
      return (w.__qrSeenVersion ?? 0) >= v && w.__qrPending === 0;
    },
    version,
  );
}

export async function openFixture(page: Page, name = 'fields.html', base = BASE): Promise<void> {
  await page.goto(`${base}/fixtures/${name}`);
  await waitForReady(page);
}

export async function expectValue(page: Page, selector: string, value: string): Promise<void> {
  await expect(page.locator(selector)).toHaveValue(value);
}
