/**
 * Real-browser fixtures: launches a full Chromium with the built extension
 * (apps/extension/dist) loaded as an unpacked extension. No API shims — the
 * extension uses Chrome's own chrome.storage, chrome.tabs, chrome.runtime.
 *
 * Test pages are plain HTML from /qa/pages served on QA_PORT; they contain no
 * QuickReply code.
 */
import { mkdtemp } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join, resolve } from 'node:path';
import { test as base, chromium, expect, type BrowserContext, type Page } from '@playwright/test';

export const EXT_PATH = process.env.QR_EXT_PATH ?? resolve(import.meta.dirname, '../dist-local');
export const QA_PORT = 4795;
export const QA = `http://localhost:${QA_PORT}`;
export const CHROME = process.env.CHROME_PATH ?? '/opt/uc/chrome';

export async function launch(userDataDir?: string): Promise<{ context: BrowserContext; extId: string; userDataDir: string }> {
  const dir = userDataDir ?? (await mkdtemp(join(tmpdir(), 'qr-real-')));
  const context = await chromium.launchPersistentContext(dir, {
    executablePath: CHROME,
    headless: true,
    viewport: { width: 1280, height: 800 },
    args: ['--headless=new', '--no-sandbox', `--disable-extensions-except=${EXT_PATH}`, `--load-extension=${EXT_PATH}`],
  });
  const extId = await findExtensionId(context);
  return { context, extId, userDataDir: dir };
}

async function findExtensionId(context: BrowserContext): Promise<string> {
  const page = await context.newPage();
  await page.goto('chrome://extensions');
  const id = await page.evaluate(async () => {
    const all = await chrome.management.getAll();
    return all.find((e) => e.name.startsWith('QuickReply'))?.id ?? '';
  });
  await page.close();
  if (!id) throw new Error('QuickReply extension did not load');
  return id;
}

export interface Ext {
  context: BrowserContext;
  extId: string;
  url: (path: string) => string;
  /** Opens a fresh extension page (dashboard/popup) and waits for React to render. */
  open: (path: string) => Promise<Page>;
  /** Reads chrome.storage.local through an extension page. */
  storage: () => Promise<Record<string, unknown>>;
  /** Writes chrome.storage.local through an extension page. */
  setStorage: (items: Record<string, unknown>) => Promise<void>;
  /** Opens a QA page in a NEW tab (like a user would). */
  qaPage: (name?: string) => Promise<Page>;
  errors: string[];
}

export const test = base.extend<{ ext: Ext }>({
  // eslint-disable-next-line no-empty-pattern -- Playwright fixture signature
  ext: async ({}, provide) => {
    const { context, extId } = await launch();
    const errors: string[] = [];
    const watch = (p: Page) => {
      p.on('pageerror', (e) => errors.push(`${p.url()}: ${e.message}`));
      p.on('console', (m) => m.type() === 'error' && errors.push(`${p.url()}: ${m.text()}`));
    };
    context.on('page', watch);
    const url = (path: string) => `chrome-extension://${extId}/${path}`;
    const evalInExt = async <T>(fn: (arg: unknown) => Promise<T>, arg?: unknown): Promise<T> => {
      const p = await context.newPage();
      await p.goto(url('popup.html'));
      const out = await p.evaluate(fn, arg);
      await p.close();
      return out;
    };
    await provide({
      context,
      extId,
      url,
      errors,
      open: async (path) => {
        const p = await context.newPage();
        await p.goto(url(path));
        await p.locator('#root > *').first().waitFor();
        return p;
      },
      storage: () => evalInExt(() => chrome.storage.local.get(null)),
      setStorage: (items) => evalInExt((i) => chrome.storage.local.set(i as Record<string, unknown>), items),
      qaPage: async (name = 'fields.html') => {
        const p = await context.newPage();
        await p.goto(`${QA}/${name}`);
        // content scripts run at document_idle
        await p.waitForLoadState('load');
        await p.waitForTimeout(300);
        return p;
      },
    });
    await context.close();
  },
});

export { expect };

export const HELLO = 'Hello! Thank you for contacting us. How can I help you today?';
export const MULTI = 'Hi there,\n\nThanks for reaching out.\nBest regards';

/** The same 7 snippets as docs/QA "Preparation" (qa-snippets.json). */
export function qaSnippets() {
  const now = Date.now();
  const s = (id: string, name: string, shortcut: string, content: string) => ({
    id, name, shortcut, content, folderId: null, favorite: false, enabled: true, createdAt: now, updatedAt: now,
  });
  return [
    s('qa-1', 'Hello', '/hello', HELLO),
    s('qa-2', 'Multi', '/multi', MULTI),
    s('qa-3', 'Hi', '/hi', 'Hi!'),
    s('qa-4', 'Hire', '/hire', 'We are hiring.'),
    s('qa-5', 'Greet', '/greet', 'Hello {name}, from {company}!'),
    s('qa-6', 'Today', '/today', 'Date: {date} {time}'),
    s('qa-7', 'Clip', '/clip', 'Copied: {clipboard}'),
  ];
}
