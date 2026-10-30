/**
 * QuickReply v1.0 — manual QA checklist automated in a real Chromium with the
 * real unpacked extension. Test titles start with the checklist ID.
 */
import { readFile, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join, resolve } from 'node:path';
import type { Page } from '@playwright/test';
import { HELLO, MULTI, QA, expect, launch, qaSnippets, test, type Ext } from './fixtures';

const SETTINGS = { enabled: true, excludedSites: [], triggerMode: 'instant', defaultPrefix: '/', theme: 'system', clipboardEnabled: false };

async function seedQa(ext: Ext, settings: Partial<typeof SETTINGS> = {}) {
  await ext.setStorage({ 'qr.snippets': qaSnippets(), 'qr.folders': [], 'qr.settings': { ...SETTINGS, ...settings }, 'qr.usage': {} });
}

async function typeIn(page: Page, selector: string, text: string) {
  await page.locator(selector).click();
  await page.keyboard.type(text, { delay: 15 });
}

const value = (page: Page, sel: string) => page.locator(sel).inputValue();
const rich = (page: Page, sel: string) => page.locator(sel).evaluate((el) => (el as HTMLElement).innerText);

/** Imports a backup file through the real Settings UI. */
async function importViaUi(ext: Ext, data: unknown, button: 'Import snippets' | 'Restore from backup' = 'Import snippets') {
  const file = join(tmpdir(), `qa-import-${Date.now()}.json`);
  await writeFile(file, JSON.stringify(data));
  const p = await ext.open('dashboard.html#/settings');
  const chooser = p.waitForEvent('filechooser');
  await p.getByRole('button', { name: button }).click();
  await (await chooser).setFiles(file);
  return p;
}

test.describe('1. Installation', () => {
  test('1.1 popup renders logo, On status and settings button', async ({ ext }) => {
    const p = await ext.open('popup.html');
    await expect(p.getByText('QuickReply').first()).toBeVisible();
    await expect(p.getByRole('button', { name: 'On', exact: true })).toBeVisible();
    await expect(p.getByRole('button', { name: 'Settings' })).toBeVisible();
    await expect(p.getByText('Create your first snippet')).toBeVisible();
  });

  test('1.2 dashboard and options page open', async ({ ext }) => {
    const p = await ext.open('dashboard.html');
    await expect(p.getByRole('heading', { name: 'All snippets' })).toBeVisible();
    await p.close();
    // Options page (right-click icon → Options) from the popup, with no dashboard tab open.
    const popup = await ext.open('popup.html');
    const optionsPage = ext.context.waitForEvent('page');
    await popup.evaluate(() => chrome.runtime.openOptionsPage());
    const opt = await optionsPage;
    await opt.waitForLoadState();
    expect(opt.url()).toContain(`chrome-extension://${ext.extId}/dashboard.html`);
    await expect(opt.getByRole('heading', { name: 'All snippets' })).toBeVisible();
  });

  test('1.3 no errors in extension pages and on test pages', async ({ ext }) => {
    await seedQa(ext);
    const popup = await ext.open('popup.html');
    const dash = await ext.open('dashboard.html#/settings');
    await dash.getByRole('button', { name: /All snippets/ }).click();
    const qa = await ext.qaPage();
    await typeIn(qa, '#input', '/hello');
    await expect.poll(() => value(qa, '#input')).toBe(HELLO);
    await popup.reload();
    await popup.waitForTimeout(500);
    // favicon.ico 404s come from the QA test server, not from the extension.
    expect(ext.errors.filter((e) => !e.includes('404'))).toEqual([]);
  });

  test('1.4 snippets survive a full browser restart', async () => {
    const first = await launch();
    const p = await first.context.newPage();
    await p.goto(`chrome-extension://${first.extId}/dashboard.html#/all?new=1`);
    await p.getByLabel('Name').fill('Persisted');
    await p.getByLabel('Shortcut').fill('/persist');
    await p.getByLabel('Text', { exact: true }).fill('I survived a restart.');
    await p.getByRole('button', { name: 'Create snippet' }).click();
    await expect(p.getByText('Snippet created')).toBeVisible();
    await first.context.close();

    const second = await launch(first.userDataDir);
    expect(second.extId).toBe(first.extId);
    const page = await second.context.newPage();
    await page.goto(`${QA}/fields.html`);
    await page.waitForTimeout(400);
    await typeIn(page, '#textarea', '/persist');
    await expect.poll(() => value(page, '#textarea')).toBe('I survived a restart.');
    await second.context.close();
  });

  test('1.5 permissions match the manifest justification', async ({ ext }) => {
    const p = await ext.open('popup.html');
    const info = await p.evaluate(async () => ({
      manifest: chrome.runtime.getManifest(),
      granted: await chrome.permissions.getAll(),
    }));
    expect(info.manifest.manifest_version).toBe(3);
    expect(info.manifest.permissions).toEqual(['storage']);
    expect(info.manifest.optional_permissions).toEqual(['clipboardRead']);
    expect(info.manifest.host_permissions ?? []).toEqual([]);
    expect(info.granted.permissions).toEqual(['storage']);
    expect(info.granted.origins).toEqual(['<all_urls>']);
  });
});

test.describe('2. Core expansion', () => {
  test.beforeEach(async ({ ext }) => seedQa(ext));

  test('2.1 input: "Sure! /hello", caret at the end', async ({ ext }) => {
    const p = await ext.qaPage();
    await typeIn(p, '#input', 'Sure! /hello');
    await expect.poll(() => value(p, '#input')).toBe(`Sure! ${HELLO}`);
    expect(await p.locator('#input').evaluate((el: HTMLInputElement) => el.selectionStart)).toBe(`Sure! ${HELLO}`.length);
  });

  test('2.2 textarea: multi-line snippet', async ({ ext }) => {
    const p = await ext.qaPage();
    await typeIn(p, '#textarea', '/multi');
    await expect.poll(() => value(p, '#textarea')).toBe(MULTI);
  });

  test('2.3 Ctrl+Z right after expansion restores the shortcut', async ({ ext }) => {
    const p = await ext.qaPage();
    await typeIn(p, '#textarea', '/multi');
    await expect.poll(() => value(p, '#textarea')).toBe(MULTI);
    await p.keyboard.press('Control+z');
    await expect.poll(() => value(p, '#textarea')).toBe('/multi');
  });

  test('2.4 "example.com/hello" does not expand', async ({ ext }) => {
    const p = await ext.qaPage();
    await typeIn(p, '#input', 'example.com/hello');
    await p.waitForTimeout(300);
    expect(await value(p, '#input')).toBe('example.com/hello');
    // control: the same field does expand a real shortcut
    await p.keyboard.type(' /hello');
    await expect.poll(() => value(p, '#input')).toBe(`example.com/hello ${HELLO}`);
  });

  test('2.5 "/hi" waits, "/hi " becomes "Hi! "', async ({ ext }) => {
    const p = await ext.qaPage();
    await typeIn(p, '#search', '/hi');
    await p.waitForTimeout(300);
    expect(await value(p, '#search')).toBe('/hi');
    await p.keyboard.type(' ');
    await expect.poll(() => value(p, '#search')).toBe('Hi! ');
  });

  test('2.6 "/hire" expands', async ({ ext }) => {
    const p = await ext.qaPage();
    await typeIn(p, '#input', '/hire');
    await expect.poll(() => value(p, '#input')).toBe('We are hiring.');
  });

  test('2.7 a disabled snippet does not expand, and works again when re-enabled', async ({ ext }) => {
    const qa = await ext.qaPage();
    const dash = await ext.open('dashboard.html#/all?s=qa-1');
    await dash.getByRole('switch', { name: 'Snippet enabled' }).click();
    await dash.getByRole('button', { name: 'Save changes' }).click();
    await expect(dash.getByText('Changes saved')).toBeVisible();
    // the already-open tab picks up the change without a reload
    await qa.bringToFront();
    await typeIn(qa, '#input', '/hello');
    await qa.waitForTimeout(300);
    expect(await value(qa, '#input')).toBe('/hello');
    await dash.bringToFront();
    await dash.getByRole('switch', { name: 'Snippet enabled' }).click();
    await dash.getByRole('button', { name: 'Save changes' }).click();
    await qa.bringToFront();
    await qa.locator('#input').fill('');
    await typeIn(qa, '#input', '/hello');
    await expect.poll(() => value(qa, '#input')).toBe(HELLO);
  });

  test('2.8 pasting a shortcut does not expand it', async ({ ext }) => {
    await ext.context.grantPermissions(['clipboard-read', 'clipboard-write'], { origin: QA });
    const p = await ext.qaPage();
    await p.locator('#input').click();
    await p.evaluate(() => navigator.clipboard.writeText('/hello'));
    await p.keyboard.press('Control+v');
    await p.waitForTimeout(300);
    expect(await value(p, '#input')).toBe('/hello');
  });
});

test.describe('3. Site compatibility', () => {
  test.beforeEach(async ({ ext }) => seedQa(ext));

  test('3.1 contenteditable: plain text, no HTML injected', async ({ ext }) => {
    const p = await ext.qaPage();
    await typeIn(p, '#editor', 'Reply: /hello');
    await expect.poll(() => rich(p, '#editor')).toBe(`Reply: ${HELLO}`);
    expect(await p.locator('#editor').evaluate((el) => el.querySelectorAll('script,img,a,iframe').length)).toBe(0);
  });

  test('3.2 Gmail-style editor: shortcut on a new line', async ({ ext }) => {
    const p = await ext.qaPage();
    await typeIn(p, '#gmail', 'Line one');
    await p.keyboard.press('Enter');
    await p.keyboard.type('/hello', { delay: 15 });
    await expect.poll(() => rich(p, '#gmail')).toBe(`Line one\n${HELLO}`);
  });

  test('3.3 editor inside open shadow DOM', async ({ ext }) => {
    const p = await ext.qaPage();
    await p.locator('#shadow-editor').click();
    await p.keyboard.type('/hello', { delay: 15 });
    await expect.poll(() => rich(p, '#shadow-editor')).toBe(HELLO);
  });

  test('3.4 React 19 controlled input: state and submit stay in sync', async ({ ext }) => {
    const p = await ext.qaPage('react.html');
    await typeIn(p, '#react-input', '/hello');
    await p.keyboard.type('!');
    await expect(p.locator('#react-state')).toHaveText(`${HELLO}!`);
    await p.getByRole('button', { name: 'Submit' }).click();
    await expect(p.locator('#react-submitted')).toHaveText(`${HELLO}!`);
    await typeIn(p, '#react-textarea', '/multi');
    await expect(p.locator('#react-area-state')).toHaveText(MULTI);
  });

  test('3.5 textarea inside an iframe', async ({ ext }) => {
    const p = await ext.qaPage('iframe.html');
    const frame = p.frameLocator('#frame');
    await frame.locator('#textarea').click();
    await p.keyboard.type('/hello', { delay: 15 });
    await expect.poll(() => frame.locator('#textarea').inputValue()).toBe(HELLO);
  });

  test('3.8 tab opened BEFORE snippets were added still expands (no reload)', async ({ ext }) => {
    await ext.setStorage({ 'qr.snippets': [] });
    const p = await ext.qaPage();
    await typeIn(p, '#input', '/hello');
    await p.waitForTimeout(200);
    expect(await value(p, '#input')).toBe('/hello');
    await seedQa(ext);
    await p.bringToFront();
    await p.locator('#input').fill('');
    await typeIn(p, '#input', '/hello');
    await expect.poll(() => value(p, '#input')).toBe(HELLO);
  });

  test('3.9 tab opened before the extension was reloaded keeps working', async ({ ext }) => {
    const p = await ext.qaPage();
    const mgr = await ext.context.newPage();
    await mgr.goto('chrome://extensions');
    await mgr.evaluate(async (id) => {
      await chrome.management.setEnabled(id, false);
      await chrome.management.setEnabled(id, true);
    }, ext.extId);
    await mgr.waitForTimeout(1500);
    await p.bringToFront();
    await typeIn(p, '#input', '/hello');
    await expect.poll(() => value(p, '#input'), { timeout: 3000 }).toBe(HELLO);
  });
});

test.describe('4. Variables and editor', () => {
  test.beforeEach(async ({ ext }) => seedQa(ext));

  test('4.1 {date} {time} are filled in', async ({ ext }) => {
    const p = await ext.qaPage();
    await typeIn(p, '#textarea', '/today');
    await expect.poll(() => value(p, '#textarea')).toMatch(/^Date: \S.+\d{4}.* \d{1,2}:\d{2}/);
  });

  test('4.2 fill-in form inserts values', async ({ ext }) => {
    const p = await ext.qaPage();
    await typeIn(p, '#textarea', 'Note: /greet');
    await expect(p.locator('quickreply-prompt')).toBeAttached();
    await p.keyboard.type('Ana');
    await p.keyboard.press('Tab');
    await p.keyboard.type('Acme');
    await p.keyboard.press('Enter');
    await expect(p.locator('quickreply-prompt')).not.toBeAttached();
    await expect.poll(() => value(p, '#textarea')).toBe('Note: Hello Ana, from Acme!');
    await p.keyboard.type(' ok');
    await expect.poll(() => value(p, '#textarea')).toBe('Note: Hello Ana, from Acme! ok');
  });

  test('4.3 Escape cancels the form and keeps the shortcut', async ({ ext }) => {
    const p = await ext.qaPage();
    await typeIn(p, '#input', '/greet');
    await expect(p.locator('quickreply-prompt')).toBeAttached();
    await p.keyboard.press('Escape');
    await expect(p.locator('quickreply-prompt')).not.toBeAttached();
    expect(await value(p, '#input')).toBe('/greet');
  });

  test('4.4 variable buttons insert tokens and preview updates', async ({ ext }) => {
    const p = await ext.open('dashboard.html#/all?new=1');
    const text = p.getByLabel('Text', { exact: true });
    await text.fill('Hi ');
    await p.getByRole('button', { name: 'Fill-in field' }).click();
    await p.keyboard.type('first_name');
    await p.keyboard.press('End');
    await p.keyboard.type(', today is ');
    await p.getByRole('button', { name: 'Date', exact: true }).click();
    await expect(text).toHaveValue('Hi {first_name}, today is {date}');
    const preview = p.getByRole('region', { name: 'Preview' });
    await expect(preview).toContainText('first_name');
    await expect(preview).toContainText(String(new Date().getFullYear()));
  });

  test('4.5 editor rejects empty name and duplicate shortcut', async ({ ext }) => {
    const p = await ext.open('dashboard.html#/all?new=1');
    await p.getByLabel('Shortcut').fill('/hello');
    await p.getByLabel('Text', { exact: true }).fill('x');
    await p.getByRole('button', { name: 'Create snippet' }).click();
    await expect(p.getByText('Name is required.')).toBeVisible();
    await expect(p.getByText('Another snippet already uses this shortcut.')).toBeVisible();
    expect(((await ext.storage())['qr.snippets'] as unknown[]).length).toBe(7);
  });

  test('4.6 {clipboard}: optional permission is not granted by default and is requested on toggle', async ({ ext }) => {
    const p = await ext.open('dashboard.html#/settings');
    expect(await p.evaluate(() => chrome.permissions.contains({ permissions: ['clipboardRead'] }))).toBe(false);
    // Chrome shows its own permission prompt here, which automation cannot answer. We check that
    // clicking the toggle does not turn the setting on before the user has granted the permission.
    await p.getByRole('switch', { name: 'Allow clipboard variable' }).click();
    await p.waitForTimeout(1000);
    await expect(p.getByRole('switch', { name: 'Allow clipboard variable' })).toHaveAttribute('aria-checked', 'false');
    expect(((await ext.storage())['qr.settings'] as { clipboardEnabled: boolean }).clipboardEnabled).toBe(false);
    // Without the permission {clipboard} is empty and nothing breaks.
    const qa = await ext.qaPage();
    await typeIn(qa, '#input', '/clip');
    await expect.poll(() => value(qa, '#input')).toBe('Copied: ');
  });
});

test.describe('5. UI and storage', () => {
  test.beforeEach(async ({ ext }) => seedQa(ext));

  test('5.1 search in popup and dashboard', async ({ ext }) => {
    const popup = await ext.open('popup.html');
    await popup.getByLabel('Search snippets').fill('hiring');
    await expect(popup.getByRole('list', { name: 'Snippets' }).getByRole('listitem')).toHaveCount(1);
    const dash = await ext.open('dashboard.html');
    await dash.getByLabel('Search snippets').fill('hiring');
    await expect(dash.getByRole('list', { name: 'Snippets' }).getByRole('listitem')).toHaveCount(1);
  });

  test('5.2 folders', async ({ ext }) => {
    const p = await ext.open('dashboard.html');
    await p.getByRole('button', { name: 'New folder' }).click();
    await p.getByLabel('Folder name').fill('Support');
    await p.keyboard.press('Enter');
    await expect(p.getByRole('heading', { name: 'Support' })).toBeVisible();
    await p.goto(ext.url('dashboard.html#/all?s=qa-1'));
    await p.getByRole('combobox', { name: 'Folder', exact: true }).selectOption({ label: 'Support' });
    await p.getByRole('button', { name: 'Save changes' }).click();
    await expect(p.getByRole('button', { name: /^Support\s*1$/ })).toBeVisible();
  });

  test('5.3 favorites', async ({ ext }) => {
    const p = await ext.open('dashboard.html#/all?s=qa-1');
    await p.getByRole('button', { name: 'Add to favorites' }).click();
    await p.getByRole('button', { name: 'Save changes' }).click();
    await p.getByRole('button', { name: /Favorites/ }).click();
    await expect(p.getByRole('list', { name: 'Snippets' })).toContainText('Hello');
  });

  test('5.4 recently used shows expanded snippets', async ({ ext }) => {
    const qa = await ext.qaPage();
    await typeIn(qa, '#input', '/hire');
    await expect.poll(() => value(qa, '#input')).toBe('We are hiring.');
    const p = await ext.open('dashboard.html#/recent');
    await expect(p.getByRole('list', { name: 'Snippets' })).toContainText('Hire');
  });

  test('5.5 duplicate creates /hello2', async ({ ext }) => {
    const p = await ext.open('dashboard.html#/all?s=qa-1');
    await p.getByRole('button', { name: 'Duplicate' }).click();
    await expect(p.getByText('Snippet duplicated')).toBeVisible();
    const shortcuts = ((await ext.storage())['qr.snippets'] as { shortcut: string }[]).map((s) => s.shortcut);
    expect(shortcuts).toContain('/hello2');
  });

  test('5.6 delete asks for confirmation', async ({ ext }) => {
    const p = await ext.open('dashboard.html#/all?s=qa-4');
    await p.getByRole('button', { name: 'Delete' }).click();
    await p.getByRole('alertdialog').getByRole('button', { name: 'Cancel' }).click();
    expect(((await ext.storage())['qr.snippets'] as unknown[]).length).toBe(7);
    await p.getByRole('button', { name: 'Delete' }).click();
    await p.getByRole('button', { name: 'Delete snippet' }).click();
    await expect.poll(async () => ((await ext.storage())['qr.snippets'] as unknown[]).length).toBe(6);
  });

  test('5.7 dark theme in dashboard and popup', async ({ ext }) => {
    const p = await ext.open('dashboard.html#/settings');
    await p.getByRole('radio', { name: 'Dark' }).click();
    await expect(p.locator('html')).toHaveClass(/dark/);
    const popup = await ext.open('popup.html');
    await expect(popup.locator('html')).toHaveClass(/dark/);
    expect(await popup.evaluate(() => getComputedStyle(document.body).backgroundColor)).toBe('rgb(14, 17, 22)');
    await p.getByRole('radio', { name: 'System' }).click();
  });
});

test.describe('6. Security', () => {
  test.beforeEach(async ({ ext }) => seedQa(ext));

  test('6.1 password field is never expanded', async ({ ext }) => {
    const p = await ext.qaPage();
    await typeIn(p, '#password', '/hello');
    await typeIn(p, '#input', '/hello'); // control
    await expect.poll(() => value(p, '#input')).toBe(HELLO);
    expect(await value(p, '#password')).toBe('/hello');
  });

  test('6.2 card-number and one-time-code fields are never expanded', async ({ ext }) => {
    const p = await ext.qaPage();
    for (const id of ['#card', '#otp', '#ignored']) await typeIn(p, id, '/hello');
    await typeIn(p, '#input', '/hello'); // control
    await expect.poll(() => value(p, '#input')).toBe(HELLO);
    for (const id of ['#card', '#otp', '#ignored']) expect(await value(p, id)).toBe('/hello');
  });

  test('6.3 excluded website (localhost) and removing it again', async ({ ext }) => {
    const qa = await ext.qaPage();
    const s = await ext.open('dashboard.html#/settings');
    await s.getByLabel('Website to turn off').fill('localhost');
    await s.getByRole('button', { name: 'Add website' }).click();
    await expect(s.getByRole('list', { name: 'Websites where QuickReply is off' })).toContainText('localhost');
    await qa.bringToFront();
    await typeIn(qa, '#input', '/hello');
    await qa.waitForTimeout(300);
    expect(await value(qa, '#input')).toBe('/hello');
    await s.bringToFront();
    await s.getByRole('button', { name: 'Turn QuickReply back on for localhost' }).click();
    await qa.bringToFront();
    await qa.locator('#input').fill('');
    await typeIn(qa, '#input', '/hello');
    await expect.poll(() => value(qa, '#input')).toBe(HELLO);
  });

  test('6.4 content script reports the site to the popup; unsupported pages are detected', async ({ ext }) => {
    await ext.qaPage();
    const special = await ext.context.newPage();
    await special.goto('chrome://version');
    const page = await ext.open('popup.html');
    // The popup asks the active tab by id (no "tabs" permission, so URLs are hidden): ask every tab.
    const answers = await page.evaluate(async () => {
      const tabs = await chrome.tabs.query({});
      const out: string[] = [];
      for (const t of tabs) {
        if (t.id === undefined) continue;
        try {
          const r = (await chrome.tabs.sendMessage(t.id, { type: 'quickreply/get-page-info' })) as { hostname?: string } | undefined;
          out.push(`host:${r?.hostname ?? '?'}`);
        } catch {
          out.push('unavailable');
        }
      }
      return out;
    });
    expect(answers).toContain('host:localhost'); // QA page answers with its hostname
    expect(answers.filter((a) => a === 'unavailable').length).toBeGreaterThanOrEqual(2); // chrome://version and the popup itself
  });

  test('6.5 global switch off and on', async ({ ext }) => {
    const qa = await ext.qaPage();
    const s = await ext.open('dashboard.html#/settings');
    await s.getByRole('switch', { name: 'Enable QuickReply' }).first().click();
    await qa.bringToFront();
    await typeIn(qa, '#input', '/hello');
    await qa.waitForTimeout(300);
    expect(await value(qa, '#input')).toBe('/hello');
    await s.bringToFront();
    await s.getByRole('switch', { name: 'Enable QuickReply' }).first().click();
    await qa.bringToFront();
    await qa.locator('#input').fill('');
    await typeIn(qa, '#input', '/hello');
    await expect.poll(() => value(qa, '#input')).toBe(HELLO);
  });

  test('6.6 extension makes no network requests while expanding', async ({ ext }) => {
    const requests: string[] = [];
    ext.context.on('request', (r) => requests.push(r.url()));
    const qa = await ext.qaPage();
    requests.length = 0;
    await typeIn(qa, '#input', '/hello');
    await typeIn(qa, '#editor', '/greet');
    await qa.keyboard.type('Bo');
    await qa.keyboard.press('Enter');
    await qa.waitForTimeout(500);
    expect(requests).toEqual([]);
  });
});

test.describe('7. Backup', () => {
  test('7.6 export, import with conflicts, broken file, restore', async ({ ext }) => {
    await seedQa(ext);
    const p = await ext.open('dashboard.html#/settings');
    const dl = p.waitForEvent('download');
    await p.getByRole('button', { name: 'Export snippets' }).click();
    const download = await dl;
    expect(download.suggestedFilename()).toMatch(/^quickreply-backup-\d{4}-\d{2}-\d{2}\.json$/);
    const exported = JSON.parse(await readFile(await download.path(), 'utf8'));
    expect(exported.snippets).toHaveLength(7);

    const imp = await importViaUi(ext, exported);
    const dialog = imp.getByRole('alertdialog', { name: 'Import snippets?' });
    await expect(dialog).toContainText('7 shortcuts already exist');
    await dialog.getByRole('button', { name: 'Import' }).click();
    await expect.poll(async () => ((await ext.storage())['qr.snippets'] as unknown[]).length).toBe(14);

    const bad = join(tmpdir(), 'bad.json');
    await writeFile(bad, '{ not json');
    const chooser = imp.waitForEvent('filechooser');
    await imp.getByRole('button', { name: 'Import snippets' }).click();
    await (await chooser).setFiles(bad);
    await expect(imp.getByRole('alert')).toHaveText('This file is not valid JSON.');

    const res = await importViaUi(ext, exported, 'Restore from backup');
    await res.getByRole('button', { name: 'Replace all snippets' }).click();
    await expect.poll(async () => ((await ext.storage())['qr.snippets'] as unknown[]).length).toBe(7);
  });

  test('7.7 the shipped qa-snippets.json imports cleanly through the UI', async ({ ext }) => {
    const data = JSON.parse(await readFile(resolve(import.meta.dirname, '../../../qa/qa-snippets.json'), 'utf8'));
    const p = await importViaUi(ext, data);
    await p.getByRole('alertdialog').getByRole('button', { name: 'Import' }).click();
    await expect.poll(async () => ((await ext.storage())['qr.snippets'] as unknown[]).length).toBe(7);
  });
});
