import { expect, test, type Page } from '@playwright/test';
import { ALT_BASE, openFixture, seed, snippet, updateStoredSettings, waitForVersion, expectValue, readStore } from './helpers';

const HELLO = 'Hello! Thank you for contacting us. How can I help you today?';
const MULTI = 'Hi there,\n\nThanks for reaching out.\nBest regards';

const library = () => [
  snippet({ id: 'hello', name: 'Hello', shortcut: '/hello', content: HELLO }),
  snippet({ id: 'multi', name: 'Multi', shortcut: '/multi', content: MULTI }),
  snippet({ id: 'hi', name: 'Hi', shortcut: '/hi', content: 'Hi!' }),
  snippet({ id: 'hire', name: 'Hire', shortcut: '/hire', content: 'We are hiring.' }),
  snippet({ id: 'off', name: 'Off', shortcut: '/off', content: 'should not expand', enabled: false }),
  snippet({ id: 'greet', name: 'Greet', shortcut: '/greet', content: 'Hello {name}, from {company}!' }),
  snippet({ id: 'today', name: 'Today', shortcut: '/today', content: 'Date: {date}' }),
];

async function richText(page: Page, selector: string): Promise<string> {
  return page.locator(selector).evaluate((el) => (el as HTMLElement).innerText);
}

test.beforeEach(async () => {
  await seed({ snippets: library() });
});

test.describe('expansion in plain fields', () => {
  test('input: replaces the shortcut and keeps the caret at the end', async ({ page }) => {
    await openFixture(page);
    await page.click('#input');
    await page.keyboard.type('Sure! /hello');
    await expectValue(page, '#input', `Sure! ${HELLO}`);
    await page.keyboard.type(' Bye');
    await expectValue(page, '#input', `Sure! ${HELLO} Bye`);
  });

  test('input: expands in the middle of existing text', async ({ page }) => {
    await openFixture(page);
    await page.fill('#input', 'start  end');
    await page.click('#input');
    await page.evaluate(() => (document.getElementById('input') as HTMLInputElement).setSelectionRange(6, 6));
    await page.keyboard.type('/hi ');
    await expectValue(page, '#input', 'start Hi!  end');
  });

  test('textarea: single and multi-line snippets', async ({ page }) => {
    await openFixture(page);
    await page.click('#textarea');
    await page.keyboard.type('/multi');
    await expectValue(page, '#textarea', MULTI);
    await page.keyboard.press('Enter');
    await page.keyboard.type('/hello');
    await expectValue(page, '#textarea', `${MULTI}\n${HELLO}`);
  });

  test('single-line input flattens line breaks', async ({ page }) => {
    await openFixture(page);
    await page.click('#input');
    await page.keyboard.type('/multi');
    await expectValue(page, '#input', MULTI.replace(/\n/g, ' '));
  });

  test('undo (Ctrl+Z) brings the shortcut back', async ({ page }) => {
    await openFixture(page);
    await page.click('#textarea');
    await page.keyboard.type('/hello');
    await expectValue(page, '#textarea', HELLO);
    await page.keyboard.press('Control+z');
    await expectValue(page, '#textarea', '/hello');
  });

  test('does not expand inside words or URLs', async ({ page }) => {
    await openFixture(page);
    await page.click('#input');
    await page.keyboard.type('example.com/hello');
    await expectValue(page, '#input', 'example.com/hello');
  });

  test('ignores disabled snippets', async ({ page }) => {
    await openFixture(page);
    await page.click('#input');
    await page.keyboard.type('/off ');
    await expectValue(page, '#input', '/off ');
  });

  test('similar shortcuts: /hi waits for a space, /hire expands', async ({ page }) => {
    await openFixture(page);
    await page.click('#input');
    await page.keyboard.type('/hire');
    await expectValue(page, '#input', 'We are hiring.');
    await page.fill('#input', '');
    await page.keyboard.type('/hi');
    await expectValue(page, '#input', '/hi');
    await page.keyboard.type(' there');
    await expectValue(page, '#input', 'Hi! there');
  });

  test('never touches password, payment, one-time-code or opted-out fields', async ({ page }) => {
    await openFixture(page);
    for (const id of ['#password', '#card', '#otp', '#ignored']) {
      await page.click(id);
      await page.keyboard.type('/hello');
      await expectValue(page, id, '/hello');
    }
  });

  test('works with a selection: typing over selected text then expanding', async ({ page }) => {
    await openFixture(page);
    await page.fill('#input', 'replace me');
    await page.click('#input');
    await page.keyboard.press('Control+a');
    await page.keyboard.type('/hello');
    await expectValue(page, '#input', HELLO);
  });

  test('pasting a shortcut does not expand it', async ({ page, context }) => {
    await context.grantPermissions(['clipboard-read', 'clipboard-write'], { origin: 'http://127.0.0.1:4789' });
    await openFixture(page);
    await page.click('#input');
    await page.evaluate(() => navigator.clipboard.writeText('/hello'));
    await page.keyboard.press('Control+v');
    await expectValue(page, '#input', '/hello');
  });
});

test.describe('expansion in contenteditable', () => {
  test('rich editor: inserts plain text', async ({ page }) => {
    await openFixture(page);
    await page.click('#editor');
    await page.keyboard.type('Reply: /hello');
    await expect.poll(() => richText(page, '#editor')).toBe(`Reply: ${HELLO}`);
    // No HTML was injected.
    expect(await page.locator('#editor').evaluate((el) => el.querySelectorAll('script,img,a').length)).toBe(0);
  });

  test('rich editor: multi-line snippet becomes line breaks', async ({ page }) => {
    await openFixture(page);
    await page.click('#editor');
    await page.keyboard.type('/multi');
    await expect.poll(() => richText(page, '#editor')).toBe(MULTI);
  });

  test('Gmail-style editor: shortcut at the start of a new line', async ({ page }) => {
    await openFixture(page);
    await page.click('#gmail');
    await page.keyboard.type('Line one');
    await page.keyboard.press('Enter');
    await page.keyboard.type('/hello');
    await expect.poll(() => richText(page, '#gmail')).toBe(`Line one\n${HELLO}`);
  });

  test('editor inside an open shadow root', async ({ page }) => {
    await openFixture(page);
    await page.locator('#shadow-editor').click();
    await page.keyboard.type('/hello');
    await expect.poll(() => page.locator('#shadow-editor').evaluate((el) => (el as HTMLElement).innerText)).toBe(HELLO);
  });
});

test('React-controlled inputs keep the expanded value in component state', async ({ page }) => {
  await openFixture(page, 'react.html');
  await page.click('#react-input');
  await page.keyboard.type('/hello');
  await expect(page.locator('#react-state')).toHaveText(HELLO);
  await expectValue(page, '#react-input', HELLO);
  // Typing more keeps state in sync (React did not reset the value).
  await page.keyboard.type('!');
  await expect(page.locator('#react-state')).toHaveText(`${HELLO}!`);
  await page.click('button[type=submit]');
  await expect(page.locator('#react-submitted')).toHaveText(`${HELLO}!`);

  await page.click('#react-textarea');
  await page.keyboard.type('/multi');
  await expect(page.locator('#react-area-state')).toHaveText(MULTI);
});

test.describe('variables', () => {
  test('{date} is filled automatically', async ({ page }) => {
    await openFixture(page);
    await page.click('#input');
    await page.keyboard.type('/today');
    const expected = `Date: ${new Date().toLocaleDateString('en-US', { year: 'numeric', month: 'short', day: 'numeric' })}`;
    await expectValue(page, '#input', expected);
  });

  test('fill-in fields show a form and insert the values', async ({ page }) => {
    await openFixture(page);
    await page.click('#textarea');
    await page.keyboard.type('Note: /greet');
    // The form lives in a closed shadow root (pages can't read it), so check its host element.
    const dialog = page.locator('quickreply-prompt');
    await expect(dialog).toBeAttached();
    await page.keyboard.type('Ana');
    await page.keyboard.press('Tab');
    await page.keyboard.type('Acme');
    await page.keyboard.press('Enter');
    await expect(dialog).not.toBeAttached();
    await expectValue(page, '#textarea', 'Note: Hello Ana, from Acme!');
    // Caret is back in the field.
    await page.keyboard.type(' ok');
    await expectValue(page, '#textarea', 'Note: Hello Ana, from Acme! ok');
  });

  test('fill-in form in a rich editor', async ({ page }) => {
    await openFixture(page);
    await page.click('#editor');
    await page.keyboard.type('/greet');
    await page.keyboard.type('Bo');
    await page.keyboard.press('Tab');
    await page.keyboard.type('Initech');
    await page.keyboard.press('Enter');
    await expect.poll(() => richText(page, '#editor')).toBe('Hello Bo, from Initech!');
  });

  test('Escape cancels and leaves the shortcut as typed', async ({ page }) => {
    await openFixture(page);
    await page.click('#input');
    await page.keyboard.type('/greet');
    await expect(page.locator('quickreply-prompt')).toBeAttached();
    await page.keyboard.press('Escape');
    await expect(page.locator('quickreply-prompt')).not.toBeAttached();
    await expectValue(page, '#input', '/greet');
  });
});

test.describe('turning expansion off', () => {
  test('global switch stops and resumes expansion live', async ({ page }) => {
    await openFixture(page);
    await waitForVersion(page, await updateStoredSettings({ enabled: false }));
    await page.click('#input');
    await page.keyboard.type('/hello');
    await expectValue(page, '#input', '/hello');

    await waitForVersion(page, await updateStoredSettings({ enabled: true }));
    await page.fill('#input', '');
    await page.keyboard.type('/hello');
    await expectValue(page, '#input', HELLO);
  });

  test('excluded site: off on that host, still on elsewhere', async ({ page, context }) => {
    await seed({ snippets: library(), settings: { excludedSites: ['localhost'] } });
    await openFixture(page, 'fields.html', ALT_BASE);
    await page.click('#input');
    await page.keyboard.type('/hello');
    await expectValue(page, '#input', '/hello');

    const other = await context.newPage();
    await openFixture(other); // 127.0.0.1
    await other.click('#input');
    await other.keyboard.type('/hello');
    await expectValue(other, '#input', HELLO);
  });

  test('changes made in the dashboard reach open tabs without reload', async ({ page }) => {
    await openFixture(page);
    await waitForVersion(page, await seed({ snippets: [snippet({ name: 'New', shortcut: '/fresh', content: 'Fresh text' })] }));
    await page.click('#input');
    await page.keyboard.type('/fresh');
    await expectValue(page, '#input', 'Fresh text');
  });

  test('keeps working after the tab is reloaded', async ({ page }) => {
    await openFixture(page);
    await page.reload();
    await openFixture(page);
    await page.click('#textarea');
    await page.keyboard.type('/hello');
    await expectValue(page, '#textarea', HELLO);
  });
});

test('delimiter mode keeps the typed space', async ({ page }) => {
  await seed({ snippets: library(), settings: { triggerMode: 'delimiter' } });
  await openFixture(page);
  await page.click('#input');
  await page.keyboard.type('/hello');
  await expectValue(page, '#input', '/hello');
  await page.keyboard.type(', ok');
  await expectValue(page, '#input', `${HELLO}, ok`);
});

test('usage is counted locally after an expansion', async ({ page }) => {
  await openFixture(page);
  await page.click('#input');
  await page.keyboard.type('/hello');
  await expectValue(page, '#input', HELLO);
  await expect.poll(async () => ((await readStore())['qr.usage'] as Record<string, { count: number }> | undefined)?.hello?.count).toBe(1);
});
