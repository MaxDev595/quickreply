import { mkdtemp, readFile, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { chromium, expect, test, type Page } from '@playwright/test';
import { BASE, openFixture, readStore, seed, snippet, storedSnippets, waitForReady, expectValue } from './helpers';

async function openDashboard(page: Page, hash = '#/all'): Promise<void> {
  await page.goto(`${BASE}/ext/dashboard.html${hash}`);
  await waitForReady(page);
}

async function openPopup(page: Page, activeHost?: string): Promise<void> {
  await page.setViewportSize({ width: 380, height: 500 });
  if (activeHost) await page.addInitScript((h) => ((window as unknown as { __qrActiveTab: string }).__qrActiveTab = h), activeHost);
  await page.goto(`${BASE}/ext/popup.html`);
  await waitForReady(page);
}

test.describe('dashboard', () => {
  test.beforeEach(async () => {
    await seed({});
  });

  test('create a snippet, then it expands on a page', async ({ page, context }) => {
    await openDashboard(page);
    await expect(page.getByText('No snippets yet')).toBeVisible();
    await page.getByRole('button', { name: 'New snippet' }).first().click();
    await page.getByLabel('Name').fill('Welcome Message');
    await page.getByLabel('Shortcut').fill('/welcome');
    await page.getByLabel('Text', { exact: true }).fill('Hello! Welcome to our service.');
    await expect(page.getByRole('region', { name: 'Preview' })).toContainText('Hello! Welcome to our service.');
    await page.getByRole('button', { name: 'Create snippet' }).click();
    await expect(page.getByText('Snippet created')).toBeVisible();

    const saved = await storedSnippets();
    expect(saved).toHaveLength(1);
    expect(saved[0]).toMatchObject({ name: 'Welcome Message', shortcut: '/welcome', content: 'Hello! Welcome to our service.', enabled: true });
    await expect(page.getByRole('list', { name: 'Snippets' })).toContainText('Welcome Message');

    const tab = await context.newPage();
    await openFixture(tab);
    await tab.click('#input');
    await tab.keyboard.type('/welcome');
    await expectValue(tab, '#input', 'Hello! Welcome to our service.');
  });

  test('validation: required fields and duplicate shortcuts are rejected', async ({ page }) => {
    await seed({ snippets: [snippet({ id: 'a', name: 'Hello', shortcut: '/hello', content: 'Hi' })] });
    await openDashboard(page, '#/all?new=1');
    await page.getByRole('button', { name: 'Create snippet' }).click();
    await expect(page.getByText('Name is required.')).toBeVisible();
    await page.getByLabel('Name').fill('Second');
    await page.getByLabel('Shortcut').fill('/hello');
    await page.getByLabel('Text', { exact: true }).fill('Other');
    await expect(page.getByText('Another snippet already uses this shortcut.')).toBeVisible();
    await page.getByRole('button', { name: 'Create snippet' }).click();
    expect(await storedSnippets()).toHaveLength(1);

    await page.getByLabel('Shortcut').fill('/hel lo');
    await expect(page.getByLabel('Shortcut')).toHaveValue('/hello'); // spaces are stripped while typing
    await page.getByLabel('Shortcut').fill('/hello2');
    await page.getByRole('button', { name: 'Create snippet' }).click();
    await expect.poll(async () => (await storedSnippets()).length).toBe(2);
  });

  test('edit a snippet, toggle favorite and folder', async ({ page }) => {
    await seed({
      snippets: [snippet({ id: 'a', name: 'Pricing', shortcut: '/pricing', content: 'Plans start at $19.' })],
      folders: [{ id: 'f1', name: 'Sales', createdAt: 1 }],
    });
    await openDashboard(page, '#/all?s=a');
    await expect(page.getByRole('button', { name: 'Save changes' })).toBeDisabled();
    await page.getByLabel('Text', { exact: true }).fill('Our plans start at $19 per month.');
    await expect(page.getByText('Unsaved changes')).toBeVisible();
    await page.getByRole('button', { name: 'Add to favorites' }).click();
    await page.getByRole('combobox', { name: 'Folder', exact: true }).selectOption('f1');
    await page.keyboard.press('Control+s');
    await expect(page.getByText('Changes saved')).toBeVisible();
    const [s] = await storedSnippets();
    expect(s).toMatchObject({ content: 'Our plans start at $19 per month.', favorite: true, folderId: 'f1' });

    await page.getByRole('button', { name: /Favorites/ }).click();
    await expect(page.getByRole('list', { name: 'Snippets' })).toContainText('Pricing');
    await page.getByRole('button', { name: /^Sales/ }).click();
    await expect(page.getByRole('list', { name: 'Snippets' })).toContainText('Pricing');
  });

  test('unsaved changes are confirmed before switching', async ({ page }) => {
    await seed({
      snippets: [
        snippet({ id: 'a', name: 'One', shortcut: '/one', content: '1' }),
        snippet({ id: 'b', name: 'Two', shortcut: '/two', content: '2' }),
      ],
    });
    await openDashboard(page, '#/all?s=a');
    await page.getByLabel('Text', { exact: true }).fill('changed');
    await page.getByRole('list', { name: 'Snippets' }).getByText('Two', { exact: true }).click();
    await expect(page.getByRole('alertdialog', { name: 'Discard unsaved changes?' })).toBeVisible();
    await page.getByRole('button', { name: 'Cancel' }).click();
    await expect(page.getByLabel('Text', { exact: true })).toHaveValue('changed');
  });

  test('delete asks for confirmation', async ({ page }) => {
    await seed({ snippets: [snippet({ id: 'a', name: 'Temp', shortcut: '/temp', content: 'x' })] });
    await openDashboard(page, '#/all?s=a');
    await page.getByRole('button', { name: 'Delete' }).click();
    const dialog = page.getByRole('alertdialog', { name: 'Delete this snippet?' });
    await expect(dialog).toBeVisible();
    await dialog.getByRole('button', { name: 'Cancel' }).click();
    expect(await storedSnippets()).toHaveLength(1);
    await page.getByRole('button', { name: 'Delete' }).click();
    await page.getByRole('button', { name: 'Delete snippet' }).click();
    await expect.poll(async () => (await storedSnippets()).length).toBe(0);
  });

  test('duplicate creates a copy with a unique shortcut', async ({ page }) => {
    await seed({ snippets: [snippet({ id: 'a', name: 'Sig', shortcut: '/sig', content: 'Best' })] });
    await openDashboard(page, '#/all?s=a');
    await page.getByRole('button', { name: 'Duplicate' }).click();
    await expect.poll(async () => (await storedSnippets()).map((s) => s.shortcut).sort()).toEqual(['/sig', '/sig2']);
  });

  test('search and folders', async ({ page }) => {
    await seed({
      snippets: [
        snippet({ id: 'a', name: 'Refund policy', shortcut: '/refund', content: 'Refunds within 30 days.' }),
        snippet({ id: 'b', name: 'Shipping', shortcut: '/ship', content: 'Ships in 2 days.' }),
      ],
    });
    await openDashboard(page);
    await page.getByLabel('Search snippets').fill('30 days');
    await expect(page.getByRole('list', { name: 'Snippets' }).getByRole('listitem')).toHaveCount(1);
    await page.getByLabel('Search snippets').fill('');

    await page.getByRole('button', { name: 'New folder' }).click();
    await page.getByLabel('Folder name').fill('Support');
    await page.keyboard.press('Enter');
    await expect(page.getByRole('heading', { name: 'Support' })).toBeVisible();
    await expect(page.getByText('No snippets in this folder yet.')).toBeVisible();
    const store = await readStore();
    expect((store['qr.folders'] as { name: string }[]).map((f) => f.name)).toEqual(['Support']);
  });

  test('variable toolbar inserts tokens and preview shows them', async ({ page }) => {
    await openDashboard(page, '#/all?new=1');
    const text = page.getByLabel('Text', { exact: true });
    await text.fill('Hi ');
    await page.getByRole('button', { name: 'Fill-in field' }).click();
    await page.keyboard.type('first_name'); // replaces the selected "name"
    await page.keyboard.press('End');
    await page.keyboard.type(', today is ');
    await page.getByRole('button', { name: 'Date', exact: true }).click();
    await expect(text).toHaveValue('Hi {first_name}, today is {date}');
    await expect(page.getByRole('region', { name: 'Preview' })).toContainText('first_name');
  });
});

test.describe('settings', () => {
  test.beforeEach(async () => {
    await seed({ snippets: [snippet({ id: 'a', name: 'Hello', shortcut: '/hello', content: 'Hello!' })] });
  });

  test('exclude a website and turn QuickReply off', async ({ page }) => {
    await openDashboard(page, '#/settings');
    await page.getByLabel('Website to turn off').fill('https://Mail.Google.com/mail/u/0');
    await page.getByRole('button', { name: 'Add website' }).click();
    await expect(page.getByRole('list', { name: 'Websites where QuickReply is off' })).toContainText('mail.google.com');
    await page.getByLabel('Website to turn off').fill('not a site');
    await page.getByRole('button', { name: 'Add website' }).click();
    await expect(page.getByText('Enter a website like')).toBeVisible();

    await page.getByRole('switch', { name: 'Enable QuickReply' }).first().click();
    await expect.poll(async () => (await readStore())['qr.settings']).toMatchObject({ enabled: false, excludedSites: ['mail.google.com'] });
  });

  test('dark theme applies to the page', async ({ page }) => {
    await openDashboard(page, '#/settings');
    await page.getByRole('radio', { name: 'Dark' }).click();
    await expect(page.locator('html')).toHaveClass(/dark/);
    const bg = await page.evaluate(() => getComputedStyle(document.body).backgroundColor);
    expect(bg).toBe('rgb(14, 17, 22)');
    await page.getByRole('radio', { name: 'Light' }).click();
    await expect(page.locator('html')).not.toHaveClass(/dark/);
  });

  test('clipboard variable asks for the optional permission', async ({ page }) => {
    await openDashboard(page, '#/settings');
    await page.getByRole('switch', { name: 'Allow clipboard variable' }).click();
    await expect.poll(async () => page.evaluate(() => (window as unknown as { __qrPermissionsRequested: unknown[] }).__qrPermissionsRequested)).toEqual([
      { permissions: ['clipboardRead'] },
    ]);
    await expect.poll(async () => (await readStore())['qr.settings']).toMatchObject({ clipboardEnabled: true });
  });

  test('export, then import with conflicts, then restore', async ({ page }, testInfo) => {
    await openDashboard(page, '#/settings');
    const downloadPromise = page.waitForEvent('download');
    await page.getByRole('button', { name: 'Export snippets' }).click();
    const download = await downloadPromise;
    expect(download.suggestedFilename()).toMatch(/^quickreply-backup-\d{4}-\d{2}-\d{2}\.json$/);
    const exported = JSON.parse(await readFile(await download.path(), 'utf8'));
    expect(exported).toMatchObject({ format: 'quickreply-backup', version: 1 });
    expect(exported.snippets).toHaveLength(1);

    // Import a file whose shortcut clashes plus one new snippet → "keep both".
    exported.snippets.push({ id: 'new1', name: 'Bye', shortcut: '/bye', content: 'Bye!' });
    const importPath = testInfo.outputPath('import.json');
    await writeFile(importPath, JSON.stringify(exported));
    await page.getByTestId('import-file').setInputFiles(importPath);
    const dialog = page.getByRole('alertdialog', { name: 'Import snippets?' });
    await expect(dialog).toContainText('1 shortcut already exists');
    await dialog.getByRole('button', { name: 'Import' }).click();
    await expect.poll(async () => (await storedSnippets()).map((s) => s.shortcut).sort()).toEqual(['/bye', '/hello', '/hello2']);

    // Broken file is rejected with a clear message and nothing changes.
    const badPath = testInfo.outputPath('bad.json');
    await writeFile(badPath, '{ not json');
    await page.getByTestId('import-file').setInputFiles(badPath);
    await expect(page.getByRole('alert')).toHaveText('This file is not valid JSON.');
    expect(await storedSnippets()).toHaveLength(3);

    // Restore the original backup → replaces everything.
    const restorePath = testInfo.outputPath('restore.json');
    await writeFile(restorePath, JSON.stringify({ ...exported, snippets: exported.snippets.slice(0, 1) }));
    await page.getByRole('button', { name: 'Restore from backup' }).click();
    await page.getByTestId('import-file').setInputFiles(restorePath);
    await page.getByRole('button', { name: 'Replace all snippets' }).click();
    await expect.poll(async () => (await storedSnippets()).map((s) => s.shortcut)).toEqual(['/hello']);
  });
});

test.describe('popup', () => {
  test('empty state offers examples', async ({ page }) => {
    await seed({});
    await openPopup(page);
    await expect(page.getByText('Create your first snippet')).toBeVisible();
    await page.getByRole('button', { name: 'Add examples' }).click();
    await expect(page.getByRole('list', { name: 'Snippets' }).getByRole('listitem')).toHaveCount(3);
  });

  test('search, copy and delete from the list', async ({ page, context }) => {
    await context.grantPermissions(['clipboard-read', 'clipboard-write'], { origin: BASE });
    await seed({
      snippets: [
        snippet({ id: 'a', name: 'Hello', shortcut: '/hello', content: 'Hello {name}!' }),
        snippet({ id: 'b', name: 'Pricing', shortcut: '/pricing', content: 'From $19' }),
      ],
    });
    await openPopup(page);
    await page.getByLabel('Search snippets').fill('pric');
    await expect(page.getByRole('list', { name: 'Snippets' }).getByRole('listitem')).toHaveCount(1);
    await page.getByLabel('Search snippets').fill('');

    await page.getByRole('button', { name: 'Copy Hello' }).click();
    await expect(page.getByText('Copied to clipboard')).toBeVisible();
    expect(await page.evaluate(() => navigator.clipboard.readText())).toBe('Hello {name}!');

    await page.getByRole('button', { name: 'More actions for Pricing' }).click();
    await page.getByRole('menuitem', { name: 'Delete' }).click();
    await page.getByRole('button', { name: 'Delete snippet' }).click();
    await expect.poll(async () => (await storedSnippets()).map((s) => s.id)).toEqual(['a']);
  });

  test('pause everywhere and turn off for the current site', async ({ page }) => {
    await seed({ snippets: [snippet({ name: 'Hello', shortcut: '/hello', content: 'Hello!' })] });
    await openPopup(page, 'www.example.com');
    await expect(page.getByText('example.com')).toBeVisible();
    await page.getByRole('switch', { name: 'Expand on www.example.com' }).click();
    await expect.poll(async () => (await readStore())['qr.settings']).toMatchObject({ excludedSites: ['example.com'] });
    await page.getByRole('button', { name: 'On', exact: true }).click();
    await expect.poll(async () => (await readStore())['qr.settings']).toMatchObject({ enabled: false });
    await expect(page.getByRole('button', { name: 'Paused' })).toBeVisible();
  });

  test('pages where QuickReply cannot run are shown as unavailable', async ({ page }) => {
    await seed({});
    await openPopup(page);
    await expect(page.getByText('Not available on this page')).toBeVisible();
  });
});

test('snippets survive a full browser restart', async () => {
  await seed({});
  const userDataDir = await mkdtemp(join(tmpdir(), 'qr-restart-'));
  const launch = () =>
    chromium.launchPersistentContext(userDataDir, {
      headless: true,
      executablePath: test.info().project.use.launchOptions?.executablePath,
      args: ['--no-sandbox'],
    });

  let browser = await launch();
  let page = await browser.newPage();
  await openDashboard(page, '#/all?new=1');
  await page.getByLabel('Name').fill('Persisted');
  await page.getByLabel('Shortcut').fill('/persist');
  await page.getByLabel('Text', { exact: true }).fill('I survived a restart.');
  await page.getByRole('button', { name: 'Create snippet' }).click();
  await expect(page.getByText('Snippet created')).toBeVisible();
  await browser.close();

  browser = await launch();
  page = await browser.newPage();
  await openDashboard(page);
  await expect(page.getByRole('list', { name: 'Snippets' })).toContainText('Persisted');
  await openFixture(page);
  await page.click('#textarea');
  await page.keyboard.type('/persist');
  await expectValue(page, '#textarea', 'I survived a restart.');
  await browser.close();
});
