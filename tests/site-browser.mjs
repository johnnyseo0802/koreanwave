// Isolated anonymous browser QA. Never submits forms or uses an existing profile.
// Supply PLAYWRIGHT_MODULE_PATH only if Playwright is provided outside this repo.
import assert from 'node:assert/strict';
import { mkdir } from 'node:fs/promises';
import { pathToFileURL } from 'node:url';
const { chromium } = await import(process.env.PLAYWRIGHT_MODULE_PATH ? pathToFileURL(process.env.PLAYWRIGHT_MODULE_PATH).href : 'playwright');
const base = process.env.QA_BASE_URL || 'http://localhost:3000';
const browser = await chromium.launch({ channel: 'msedge', headless: true });
const context = await browser.newContext();
// Guard against accidental mutations even if a future test starts a form action.
await context.route('**/*', route => ['GET', 'HEAD', 'OPTIONS'].includes(route.request().method()) ? route.continue() : route.abort());
const page = await context.newPage();
const failures = [];
page.on('pageerror', () => failures.push('Browser runtime error (details withheld)'));
const publicPaths = ['/', '/k-contents', '/k-contents/music', '/k-contents/dramas', '/k-contents/movies', '/local-korea', '/local-korea/places', '/local-korea/experiences', '/k-trends', '/k-trends/beauty', '/k-trends/fashion', '/k-trends/food', '/community', '/community/questions', '/community/reviews', '/events', '/login', '/signup', '/about', '/safety', '/faq', '/contact', '/privacy', '/terms', '/cancellation'];
await mkdir('.next/site-qa', { recursive: true });
try {
  for (const [name, width] of [['mobile', 375], ['tablet', 768], ['desktop', 1440]]) {
    await page.setViewportSize({ width, height: 900 });
    for (const path of publicPaths) {
      const response = await page.goto(base + path, { waitUntil: 'networkidle' });
      assert.equal(response.status(), 200, `${path}: expected HTTP 200`);
      assert.equal(await page.locator('h1').count(), 1, `${path}: one h1`);
      assert.ok((await page.title()).includes('Korean Wave Community'), `${path}: title`);
      const overflow = await page.evaluate(() => document.documentElement.scrollWidth > innerWidth + 1);
      assert.equal(overflow, false, `${name} ${path}: horizontal overflow`);
      if (path === '/') {
        assert.equal(await page.locator('header nav[aria-label="Main navigation"]').isVisible(), width >= 1280);
        if (width < 1280) {
          const menu = page.locator('summary[aria-label="Main menu"]');
          await menu.focus(); await page.keyboard.press('Enter');
          await page.locator('#mobile-navigation').waitFor({ state: 'visible' });
          assert.equal(await page.locator('#mobile-navigation').isVisible(), true);
          await page.keyboard.press('Escape');
          await page.locator('#mobile-navigation').waitFor({ state: 'hidden' });
          assert.equal(await page.locator('#mobile-navigation').isVisible(), false);
          await menu.click();
          await page.locator('#mobile-navigation').getByRole('link', { name: 'Community', exact: true }).click();
          await page.waitForURL('**/community');
          assert.ok(new URL(page.url()).pathname === '/community');
          assert.equal(await page.locator('#mobile-navigation').isVisible(), false);
          await page.goto(base, { waitUntil: 'networkidle' });
        }
        await page.screenshot({ path: `.next/site-qa/${name}.png`, fullPage: true });
      }
    }
    console.log(`PASS: ${name} ${width}px — ${publicPaths.length} pages, overflow, heading, metadata, menu checks`);
  }
  for (const path of ['/account', '/account/events', '/write', '/write/question', '/admin/questions', '/admin/answers', '/admin/reviews', '/admin/event-applications', '/admin/content', '/admin/content/new', '/admin/content/aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa', '/admin/content/aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa/preview']) {
    await page.goto(base + path, { waitUntil: 'networkidle' });
    assert.equal(new URL(page.url()).pathname, '/login');
    assert.equal(new URL(page.url()).searchParams.get('next'), path);
  }
  // Invalid IDs share the public not-found screen; no private identifiers needed.
  for (const path of ['/articles/not-an-id', '/event/not-an-id', '/community/questions/not-an-id', '/local-korea/places/not-an-id', '/local-korea/experiences/not-an-id', '/missing-page']) {
    await page.goto(base + path, { waitUntil: 'networkidle' });
    assert.equal(await page.getByRole('heading', { name: 'This page isn’t available.' }).count(), 1);
  }
  // Follow only IDs already disclosed by public listing links. Never guess private rows.
  for (const [listing, prefix] of [['/events', '/event/'], ['/community/questions', '/community/questions/'], ['/local-korea/places', '/local-korea/places/'], ['/local-korea/experiences', '/local-korea/experiences/'], ['/k-contents', '/articles/'], ['/k-trends', '/articles/']]) {
    await page.goto(base + listing, { waitUntil: 'networkidle' });
    const href = await page.locator(`a[href^="${prefix}"]`).first().getAttribute('href').catch(() => null);
    if (!href) { console.log(`SKIP: ${listing} detail — no public item available`); continue; }
    for (const width of [375, 768, 1440]) {
      await page.setViewportSize({ width, height: 900 });
      await page.goto(base + href, { waitUntil: 'networkidle' });
      assert.equal(await page.locator('h1').count(), 1);
      assert.equal(await page.evaluate(() => document.documentElement.scrollWidth > innerWidth + 1), false);
    }
    console.log(`PASS: ${listing} public detail at three widths (identifier withheld)`);
  }
  assert.equal(failures.length, 0, 'No browser runtime errors');
  console.log('PASS: anonymous protected redirects, safe missing pages, public detail links. No form submissions or mutations.');
} finally { await context.close(); await browser.close(); }
