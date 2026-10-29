import { resolve } from 'node:path';
import { expect, test } from '@playwright/test';

const HELLO = 'Hello! Thank you for contacting us. How can I help you today?';

test('hero demo expands a typed shortcut', async ({ page }) => {
  await page.goto('/');
  const box = page.getByLabel(/Message\. Type a shortcut/);
  await box.click(); // stops the autoplay
  await page.keyboard.type('Hi Jordan! /pricing');
  await expect(box).toHaveValue('Hi Jordan! Our plans start at $19 per month. Let me know if you’d like more details!');
  await expect(page.getByText('/pricing expanded to')).toBeVisible();
});

test('demo autoplay and shortcut buttons work', async ({ page }) => {
  await page.goto('/');
  const box = page.getByLabel(/Message\. Type a shortcut/);
  await expect(box).toHaveValue(HELLO, { timeout: 6000 });
  await page.getByRole('button', { name: 'Type /sig' }).click();
  await expect(box).toHaveValue(`${HELLO} Best regards,\nSam Rivera\nCustomer Success`);
});

test('install button is honest before publishing', async ({ page }) => {
  await page.goto('/');
  await expect(page.getByRole('note').first()).toContainText('Coming soon');
  expect(await page.locator('a[href*="chromewebstore"]').count()).toBe(0);
});

test('nav, FAQ, legal pages and SEO tags', async ({ page }) => {
  await page.goto('/');
  await expect(page).toHaveTitle('QuickReply — Text Expander & Auto Text for Chrome');
  await expect(page.locator('meta[name="description"]')).toHaveAttribute('content', /text expander/);
  await expect(page.locator('meta[property="og:image"]')).toHaveAttribute('content', /og\.png/);
  expect(await page.locator('script[type="application/ld+json"]').count()).toBe(2);

  await page.getByText('Does QuickReply collect my messages?').click();
  await expect(page.getByText('QuickReply has no servers and never sends what you type anywhere.')).toBeVisible();

  for (const [link, heading] of [['Privacy Policy', 'Privacy Policy'], ['Terms of Service', 'Terms of Service'], ['Contact', 'Contact']] as const) {
    await page.goto('/');
    await page.getByRole('navigation', { name: 'Footer' }).getByRole('link', { name: link }).click();
    await expect(page.getByRole('heading', { level: 1, name: heading })).toBeVisible();
  }
  const sitemap = await page.request.get('/sitemap.xml');
  expect(await sitemap.text()).toContain('/privacy/');
});

test('screenshots for review', async ({ page }) => {
  test.skip(!process.env.SCREENSHOTS, 'Set SCREENSHOTS=1');
  const out = resolve(import.meta.dirname, '../../../docs/screenshots');
  await page.setViewportSize({ width: 1440, height: 900 });
  await page.goto('/');
  await page.waitForTimeout(2600);
  await page.screenshot({ path: `${out}/website-hero.png` });
  await page.screenshot({ path: `${out}/website-full.png`, fullPage: true });
  await page.setViewportSize({ width: 390, height: 844 });
  await page.goto('/');
  await page.waitForTimeout(2600);
  await page.screenshot({ path: `${out}/website-mobile.png`, fullPage: true });
});
