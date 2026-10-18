const { test, expect } = require('@playwright/test');
const fs = require('fs');

// IMPORTANT: Update GMA_WIDTHS to the exact six widths specified by the
// original Phase 5 acceptance matrix. The defaults are examples only.
const widths = (process.env.GMA_WIDTHS || '320,375,430,768,1024,1440')
  .split(',').map(s => Number(s.trim()));
if (widths.length !== 6 || widths.some(w => !Number.isInteger(w) || w < 240 || w > 3840)) {
  throw new Error('GMA_WIDTHS must be exactly six comma-separated integer CSS-pixel widths');
}
const routes = (process.env.GMA_ROUTES || '/collections/carpentry,/pages/custom-design-studio')
  .split(',').map(s => s.trim()).filter(Boolean);
if (routes.some(route => !route.startsWith('/') || route.startsWith('//'))) {
  throw new Error('GMA_ROUTES must be comma-separated relative storefront routes, each beginning with /');
}

// Shopify Horizon's password field is present in the DOM but hidden behind a dialog.
// IMPORTANT: All width tests run serially; a real authentication failure stops the run.
async function unlockIfNecessary(page) {
  // Storefront password ONLY, never Shopify admin/API credentials.
  if (!process.env.GMA_PASSWORD) {
    throw new Error('Missing GMA_PASSWORD: configure GitHub Actions secret GMA_STOREFRONT_PASSWORD');
  }
  await page.goto('/password', { waitUntil: 'domcontentloaded' });
  const passwordInput = page.locator('input[name="password"]');
  if (!(await passwordInput.isVisible())) {
    const openerLabel = /enter using password|enter with password|store password/i;
    // Use visible accessible controls; a hidden DOM input is not an open form.
    const openers = [
      page.getByRole('link', { name: openerLabel }),
      page.getByRole('button', { name: openerLabel }),
      page.getByText(openerLabel),
    ];
    let opened = false;
    for (const candidates of openers) {
      for (let i = 0, n = await candidates.count(); i < n; i++) {
        const candidate = candidates.nth(i);
        if (await candidate.isVisible()) {
          await candidate.click();
          opened = true;
          break;
        }
      }
      if (opened) break;
    }
    if (!opened) {
      throw new Error('Password dialog is closed and no visible opener was found; stop without submitting');
    }
  }
  await passwordInput.waitFor({ state: 'visible', timeout: 8000 });
  const form = page.locator('form:has(input[name="password"])').first();
  if (!(await form.count())) {
    throw new Error('Password input has no matching form; stop without submitting');
  }
  await passwordInput.fill(process.env.GMA_PASSWORD);
  await form.locator('button[type="submit"], input[type="submit"], button:not([type])').first().click();

  // Do not treat a completed click as a successful login. Check a protected
  // collection after submission; stop on failure before any screenshots.
  const checkRoute = '/collections/carpentry';
  await page.goto(checkRoute, { waitUntil: 'domcontentloaded' });
  await assertUnlocked(page, checkRoute);
}

async function assertUnlocked(page, requestedRoute) {
  const expectedPath = new URL(requestedRoute, page.url()).pathname.replace(/\/$/, '');
  const actualPath = new URL(page.url()).pathname.replace(/\/$/, '');
  const stillPasswordPage = (await page.locator('input[name="password"]').count()) > 0;
  if (actualPath !== expectedPath || stillPasswordPage) {
    throw new Error(`Storefront authentication or route check failed for ${requestedRoute}; no screenshot captured; stop and investigate`);
  }
}

async function snapshot(page, route, width, testInfo) {
  await page.goto(route, { waitUntil: 'domcontentloaded' });
  await assertUnlocked(page, route);
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
    // V1.2: A mobile page with an overflowing min-width element can report
    // window.innerWidth > the emulated device width (e.g. 324 on a 320px
    // screen). The layout viewport remains root.clientWidth === 320.
    // Do not force innerWidth smaller with CDP or use innerWidth as the
    // overflow denominator: either can conceal a genuine layout defect.
    const layoutViewportWidth = root.clientWidth;
    const documentScrollWidth = Math.max(root.scrollWidth, document.body.scrollWidth);
    const horizontalOverflowPx = Math.max(0, documentScrollWidth - layoutViewportWidth);
    const overflowCandidates = horizontalOverflowPx ?
      [...document.body.querySelectorAll('*')].filter(el => {
        const style = getComputedStyle(el);
        if (style.display === 'none' || style.visibility === 'hidden') return false;
        const r = el.getBoundingClientRect();
        return r.width > 0 && r.height > 0 &&
          (r.right > layoutViewportWidth + 0.5 || r.left < -0.5);
      }).slice(0, 40).map(el => {
        const r = el.getBoundingClientRect();
        return {
          tag: el.tagName.toLowerCase(), id: el.id || null,
          className: String(el.className || '').slice(0, 100),
          left: Math.round(r.left * 10) / 10, right: Math.round(r.right * 10) / 10,
          width: Math.round(r.width * 10) / 10,
        };
      }) : [];
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
      // Strict CSS layout viewport check still uses exact equality below.
      viewportWidth: layoutViewportWidth,
      windowInnerWidth: window.innerWidth, // diagnostic: may expand on mobile when content overflows
      visualViewportWidth: window.visualViewport ? window.visualViewport.width : null,
      screenWidth: window.screen.width,
      viewportMeta: document.querySelector('meta[name="viewport"]')?.content || null,
      documentScrollWidth: root.scrollWidth,
      bodyScrollWidth: document.body.scrollWidth,
      horizontalOverflowPx,
      overflowCandidates,
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

// Abort the six-width sequence after the FIRST failing test (no repeated wrong-password submissions).
test.describe.configure({ mode: 'serial' });

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
