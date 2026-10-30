/**
 * 4.6 {clipboard} with the permission granted. Chrome's optional-permission
 * prompt cannot be answered in automation, so this builds a copy of the
 * extension where clipboardRead is granted at install. navigator.clipboard is
 * disabled in that copy, so the test proves the execCommand('paste') path that
 * real sites rely on (readText() is gated by the page's permission there).
 */
import { cp, mkdtemp, readFile, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { chromium } from '@playwright/test';
import { CHROME, EXT_PATH, QA, expect, qaSnippets, test } from './fixtures';

async function variant(withPermission: boolean): Promise<string> {
  const dir = await mkdtemp(join(tmpdir(), 'qr-clip-'));
  await cp(EXT_PATH, dir, { recursive: true });
  const manifest = JSON.parse(await readFile(join(dir, 'manifest.json'), 'utf8'));
  manifest.permissions = withPermission ? ['storage', 'clipboardRead'] : ['storage'];
  delete manifest.optional_permissions;
  await writeFile(join(dir, 'manifest.json'), JSON.stringify(manifest));
  const content = await readFile(join(dir, 'content.js'), 'utf8');
  expect(content).toContain('navigator.clipboard.readText()');
  await writeFile(join(dir, 'content.js'), content.replace('navigator.clipboard.readText()', 'Promise.reject(new Error("disabled"))'));
  return dir;
}

for (const withPermission of [true, false]) {
  test(`4.6 {clipboard} ${withPermission ? 'inserts clipboard text when permission is granted' : 'stays empty without permission'}`, async () => {
    const ext = await variant(withPermission);
    const context = await chromium.launchPersistentContext(await mkdtemp(join(tmpdir(), 'qr-prof-')), {
      executablePath: CHROME,
      headless: true,
      args: ['--headless=new', '--no-sandbox', `--disable-extensions-except=${ext}`, `--load-extension=${ext}`],
    });
    try {
      const mgr = await context.newPage();
      await mgr.goto('chrome://extensions');
      const id = await mgr.evaluate(async () => (await chrome.management.getAll()).find((e) => e.name.startsWith('QuickReply'))?.id);
      await mgr.goto(`chrome-extension://${id}/popup.html`);
      await mgr.evaluate((snippets) =>
        chrome.storage.local.set({
          'qr.snippets': snippets,
          'qr.settings': { enabled: true, excludedSites: [], triggerMode: 'instant', defaultPrefix: '/', theme: 'system', clipboardEnabled: true },
        }), qaSnippets());
      const page = await context.newPage();
      await page.goto(`${QA}/fields.html`);
      await page.waitForTimeout(300);
      await context.grantPermissions(['clipboard-write'], { origin: QA });
      await page.evaluate(() => navigator.clipboard.writeText('banana'));
      const expected = withPermission ? 'x Copied: banana' : 'x Copied: ';

      await page.locator('#input').click();
      await page.keyboard.type('x /clip', { delay: 15 });
      await expect.poll(() => page.locator('#input').inputValue()).toBe(expected);
      expect(await page.evaluate(() => document.activeElement?.id)).toBe('input');

      await page.locator('#editor').click();
      await page.keyboard.type('x /clip', { delay: 15 });
      await expect.poll(() => page.locator('#editor').evaluate((e) => (e as HTMLElement).innerText.replace(/\u00a0/g, ' '))).toBe(expected);
      expect(await page.evaluate(() => document.querySelectorAll('textarea[data-quickreply-ignore]').length)).toBe(0);
    } finally {
      await context.close();
    }
  });
}
