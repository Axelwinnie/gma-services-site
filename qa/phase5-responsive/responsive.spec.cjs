const { test, expect } = require('@playwright/test');
const fs = require('fs');

// IMPORTANT: Update GMA_WIDTHS to the exact six widths specified by the
// original Phase 5 acceptance matrix. The defaults are examples only.
const widths = (process.env.GMA_WIDTHS || '320,360,375,390,768,1024')
  .split(',').map(s => Number(s.trim()));
if (widths.length !== 6 || widths.some(w => !Number.isInteger(w) || w < 240 || w > 3840)) {
  throw new Error('GMA_WIDTHS must be exactly six comma-separated integer CSS-pixel widths');
}
const routes = (process.env.GMA_ROUTES || '/collections/carpentry,/collections/roofing,/collections/steel,/pages/custom-design-studio')
  .split(',').map(s => s.trim()).filter(Boolean);
if (routes.some(route => !route.startsWith('/') || route.startsWith('//'))) {
  throw new Error('GMA_ROUTES must be comma-separated relative storefront routes, each beginning with /');
}

async function unlockIfNecessary(page) {
  // Password-gated store; use ONLY the Shopify storefront password, never an admin password.
  if (!process.env.GMA_PASSWORD) {
    throw new Error('Missing GMA_PASSWORD: configure GitHub Actions secret GMA_STOREFRONT_PASSWORD');
  }
  await page.goto('/password', { waitUntil: 'domcontentloaded' });
  const passwordInput = page.locator('input[name="password"]');
  if (!(await passwordInput.count())) {
    const open = page.getByText(/enter using password|enter with password|store password/i).first();
    if (await open.count()) await open.click();
  }
  if (!(await passwordInput.count())) {
    throw new Error('Could not locate Shopify storefront password form; investigate page rather than bypass access');
  }
  await passwordInput.fill(process.env.GMA_PASSWORD);
  const form = page.locator('form:has(input[name="password"])').first();
  await Promise.all([
    page.waitForLoadState('domcontentloaded').catch(() => {}),
    form.locator('button[type="submit"], input[type="submit"], button:not([type])').first().click(),
  ]);
}

async function snapshot(page, route, width, testInfo) {
  await page.goto(route, { waitUntil: 'domcontentloaded' });
  await page.locator('body').waitFor();
  await page.waitForTimeout(700); // stabilize initial layout; NOT a guarantee of image load
  if (await page.locator('input[name="password"]:visible').count()) {
    throw new Error(`Password challenge still visible at ${route}: login failed or session not retained`);
  }
  if (/\/pages\/custom-design-studio/.test(route) && /404|not found/i.test((await page.title()) || '')) {
    throw new Error('Design Studio page not found; verify actual route from Shopify admin');
  }
  const data = await page.evaluate(() => {
    const root = document.documentElement;
    const displayed = selector => [...document.querySelectorAll(selector)].filter(el => {
      const r = el.getBoundingClientRect(); const cs = getComputedStyle(el);
      return r.width > 0 && r.height > 0 && cs.visibility !== 'hidden' && cs.display !== 'none';
    });
    const controls = displayed('button, a[href], input, select, [role="button"]')
      .map(el => {
        const r = el.getBoundingClientRect();
        return {label: (el.getAttribute('aria-label') || el.textContent || el.getAttribute('value') || '').trim().slice(0, 70), width: Math.round(r.width), height: Math.round(r.height), x: Math.round(r.x)};
      }).filter(c => c.width > 0).slice(0, 300);
    return {
      viewportWidth: innerWidth, documentScrollWidth: root.scrollWidth,
      bodyScrollWidth: document.body.scrollWidth,
      horizontalOverflowPx: Math.max(0, root.scrollWidth - innerWidth),
      title: document.title,
      headingText: [...document.querySelectorAll('h1')].map(x => x.textContent.trim()).slice(0, 5),
      controlsUnder44px: controls.filter(c => c.width < 44 || c.height < 44),
      visibleControlsSampleSize: controls.length,
      note: 'Under-44 controls are review candidates, not automatic WCAG failures; measure the actual targets required by the approved test plan.'
    };
  });
  const safeRoute = route.replace(/[^a-z0-9]+/gi, '-').replace(/^-|-$/g, '');
  const screenshotName = `${width}-${safeRoute}.png`;
  const png = await page.screenshot({ fullPage: true, animations: 'disabled' });
  await testInfo.attach(screenshotName, { body: png, contentType: 'image/png' });
  await testInfo.attach(`${width}-${safeRoute}.json`, {
    body: Buffer.from(JSON.stringify({route, width, ...data}, null, 2)),
    contentType: 'application/json',
  });
  expect(data.viewportWidth, `${route} CSS viewport`).toBe(width);
  expect(data.horizontalOverflowPx, `${route} global horizontal overflow at ${width}px`).toBe(0);
  expect(data.headingText.length, `${route} missing h1`).toBeGreaterThan(0);
  return data;
}

for (const width of widths) {
  test(`GMA Phase 5 exact-width ${width}px — screenshot + overflow evidence`, async ({ browser }, testInfo) => {
    // Mobile emulation is separate from mere browser window resizing.
    const isMobile = width < 768;
    const context = await browser.newContext({
      viewport: {width, height: 900},
      screen: {width, height: 900},
      isMobile,
      hasTouch: isMobile,
      deviceScaleFactor: 1,
    });
    const page = await context.newPage();
    try {
      await unlockIfNecessary(page);
      for (const route of routes) await snapshot(page, route, width, testInfo);
    } finally {
      await context.close();
    }
  });
}

// Keyboard accessibility must be checked in addition to responsive widths:
// manual reviewer should inspect focus outlines, tab order and controls
// using the screenshots/traces or a browser in interactive mode.
