/**
 * Renders the UI for visual review and Chrome Web Store screenshots (1280×800).
 * Skipped in normal runs. Run: SCREENSHOTS=1 npx playwright test screenshots
 */
import { resolve } from 'node:path';
import { expect, test, type Page } from '@playwright/test';
import { BASE, openFixture, seed, snippet, waitForReady } from './helpers';

const OUT = resolve(import.meta.dirname, '../../../docs/screenshots');
test.skip(!process.env.SCREENSHOTS, 'Set SCREENSHOTS=1 to render screenshots');

const day = 86_400_000;
const now = Date.now();
const demo = () => {
  const list = [
    snippet({ id: 's1', name: 'Greeting', shortcut: '/hello', content: 'Hello! Thank you for contacting us. How can I help you today?', favorite: true, folderId: 'support' }),
    snippet({ id: 's2', name: 'Pricing', shortcut: '/pricing', content: 'Our plans start at $19 per month. Let me know if you’d like more details!', folderId: 'sales' }),
    snippet({ id: 's3', name: 'Follow-up', shortcut: '/followup', content: 'Hi {name},\n\nJust following up on my last message about {topic}. Do you have a few minutes this week to talk?\n\nBest regards,\nSam', favorite: true, folderId: 'sales' }),
    snippet({ id: 's4', name: 'Refund policy', shortcut: '/refund', content: 'You can request a full refund within 30 days of purchase. Just reply to this email with your order number.', folderId: 'support' }),
    snippet({ id: 's5', name: 'Interview invite', shortcut: '/interview', content: 'Hi {name}, thanks for applying! Are you available for a 30-minute call on {date}?', folderId: 'recruiting' }),
    snippet({ id: 's6', name: 'Meeting link', shortcut: '/zoom', content: 'Here is the link for our call: https://example.com/meet/sam' }),
    snippet({ id: 's7', name: 'Signature', shortcut: '/sig', content: 'Sam Rivera\nCustomer Success, Northwind' }),
  ];
  list.forEach((s, i) => {
    s.updatedAt = now - i * day * 1.3;
    s.createdAt = s.updatedAt - day * 4;
  });
  return list;
};
const folders = [
  { id: 'support', name: 'Support', createdAt: 1 },
  { id: 'sales', name: 'Sales', createdAt: 2 },
  { id: 'recruiting', name: 'Recruiting', createdAt: 3 },
];

async function shot(page: Page, name: string) {
  await page.waitForTimeout(250);
  await page.screenshot({ path: `${OUT}/${name}.png` });
}

test('dashboard light', async ({ page }) => {
  await seed({ snippets: demo(), folders, settings: { theme: 'light' } });
  await page.setViewportSize({ width: 1280, height: 800 });
  await page.goto(`${BASE}/ext/dashboard.html#/all?s=s3`);
  await waitForReady(page);
  await shot(page, 'dashboard-light');
});

test('dashboard dark', async ({ page }) => {
  await seed({ snippets: demo(), folders, settings: { theme: 'dark' } });
  await page.setViewportSize({ width: 1280, height: 800 });
  await page.goto(`${BASE}/ext/dashboard.html#/all?s=s1`);
  await waitForReady(page);
  await shot(page, 'dashboard-dark');
});

test('settings', async ({ page }) => {
  await seed({ snippets: demo(), folders, settings: { theme: 'light', excludedSites: ['bank.example.com'] } });
  await page.setViewportSize({ width: 1280, height: 800 });
  await page.goto(`${BASE}/ext/dashboard.html#/settings`);
  await waitForReady(page);
  await shot(page, 'settings');
});

test('popup', async ({ page }) => {
  await seed({ snippets: demo(), folders, settings: { theme: 'light' } });
  await page.addInitScript(() => ((window as unknown as { __qrActiveTab: string }).__qrActiveTab = 'mail.google.com'));
  await page.setViewportSize({ width: 380, height: 500 });
  await page.goto(`${BASE}/ext/popup.html`);
  await waitForReady(page);
  await shot(page, 'popup');
  await seed({ settings: { theme: 'dark' } });
  await page.reload();
  await waitForReady(page);
  await shot(page, 'popup-empty-dark');
});

test('fill-in form on a page', async ({ page }) => {
  await seed({ snippets: demo(), folders });
  await page.setViewportSize({ width: 1280, height: 800 });
  await openFixture(page);
  await page.click('#textarea');
  await page.keyboard.type('/followup');
  await expect(page.locator('quickreply-prompt')).toBeAttached();
  await page.keyboard.type('Jordan');
  await shot(page, 'fill-in');
});
