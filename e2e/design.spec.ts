// Design-system checks for the build (#4): overflow, control sizes, focus ring, radii, fonts and token contrast.
import { expect, test } from '@playwright/test';
import { PROTOTYPE, openApp, tokenContrast } from './helpers';
import { STATES } from './states';

test.skip(PROTOTYPE, 'design checks apply to the build only');

for (const width of [320, 375, 768, 1280]) {
  for (const [name, setup] of Object.entries(STATES)) {
    test(`${width}px ${name}: no horizontal scroll`, async ({ page }) => {
      await page.setViewportSize({ width, height: 900 });
      await openApp(page);
      await setup(page);
      const { scrollWidth, clientWidth } = await page.evaluate(() => ({
        scrollWidth: document.documentElement.scrollWidth,
        clientWidth: document.documentElement.clientWidth,
      }));
      expect(scrollWidth).toBeLessThanOrEqual(clientWidth);
    });
  }
}

test('controls: 16px text, 44px primary controls, buttons at least 24×24', async ({ page }) => {
  await openApp(page);
  await STATES['tips-and-pieces']!(page);
  const controls = await page.locator('input:visible, select:visible').evaluateAll((els) =>
    els.map((el) => ({ id: el.id, font: parseFloat(getComputedStyle(el).fontSize), h: el.getBoundingClientRect().height, sw: el.getAttribute('role') === 'switch' })),
  );
  expect(controls.length).toBeGreaterThan(10);
  for (const c of controls) {
    expect(c.font, c.id).toBeGreaterThanOrEqual(16);
    if (!c.sw) expect(c.h, c.id).toBeGreaterThanOrEqual(44);
  }
  const buttons = await page.locator('button:visible').evaluateAll((els) =>
    els.map((el) => ({ text: el.textContent, cls: el.className, ...el.getBoundingClientRect().toJSON() })),
  );
  expect(buttons.some((b) => b.cls.includes('ghost'))).toBe(true);
  for (const b of buttons) {
    expect(b.width, b.text!).toBeGreaterThanOrEqual(24);
    expect(b.height, b.text!).toBeGreaterThanOrEqual(24);
    if (b.cls.includes('main') || b.cls.includes('chip')) expect(b.height, b.text!).toBeGreaterThanOrEqual(44);
  }
});

test('focused input shows a ring of at least 2px', async ({ page }) => {
  await openApp(page);
  await page.locator('#mass').focus();
  const outline = await page.locator('#mass').evaluate((el) => {
    const s = getComputedStyle(el);
    return { width: parseFloat(s.outlineWidth), style: s.outlineStyle };
  });
  expect(outline.width).toBeGreaterThanOrEqual(2);
  expect(outline.style).not.toBe('none');
});

test('every radius comes from the 4/6/10px scale, no pills', async ({ page }) => {
  await openApp(page);
  await STATES['tips-and-pieces']!(page);
  await page.locator('#night').check();
  const radii = await page.evaluate(() => {
    const found = new Set<string>();
    const corners = ['borderTopLeftRadius', 'borderTopRightRadius', 'borderBottomLeftRadius', 'borderBottomRightRadius'] as const;
    for (const el of document.querySelectorAll('*')) {
      for (const pseudo of [null, '::before', '::after']) {
        const s = getComputedStyle(el, pseudo);
        for (const c of corners) found.add(s[c]);
      }
    }
    return [...found];
  });
  for (const r of radii) expect(['0px', '4px', '6px', '10px']).toContain(r);
});

test('Inter is self-hosted: no third-party font request, the font loads', async ({ page }) => {
  const requests: string[] = [];
  const fontStatus: number[] = [];
  page.on('request', (r) => requests.push(r.url()));
  page.on('response', (r) => {
    if (r.url().includes('InterVariable.woff2')) fontStatus.push(r.status());
  });
  await openApp(page);
  const loaded = await page.evaluate(async () => {
    await document.fonts.ready;
    return {
      check: document.fonts.check('16px Inter'),
      face: [...document.fonts].some((f) => f.family.replace(/"/g, '') === 'Inter' && f.status === 'loaded'),
      family: getComputedStyle(document.body).fontFamily,
    };
  });
  expect(requests.filter((u) => /fonts\.(googleapis|gstatic)\.com/.test(u))).toEqual([]);
  expect(requests.every((u) => new URL(u).hostname === '127.0.0.1')).toBe(true);
  expect(fontStatus.length).toBeGreaterThan(0);
  expect(fontStatus.every((s) => s === 200)).toBe(true);
  expect(loaded.check).toBe(true);
  expect(loaded.face).toBe(true);
  expect(loaded.family).toMatch(/^"?Inter"?,/);
});

test('colour tokens meet WCAG contrast', async ({ page }) => {
  await openApp(page);
  const pairs: [string, string, number][] = [
    ['--text', '--bg', 4.5],
    ['--text', '--surface', 4.5],
    ['--text-muted', '--surface', 4.5],
    ['--text-muted', '--bg', 4.5],
    ['--text-muted', '--surface-2', 4.5],
    ['--accent-contrast', '--accent', 4.5],
    ['--accent', '--surface', 4.5],
    ['--accent', '--accent-soft', 4.5],
    ['--ok', '--ok-soft', 4.5],
    ['--warn', '--warn-soft', 4.5],
    ['--wet', '--wet-soft', 4.5],
    ['--input-border', '--surface', 3],
    ['--input-border', '--bg', 3],
    ['--ring', '--surface', 3],
    ['--ring', '--bg', 3],
  ];
  for (const [fg, bg, min] of pairs) expect(await tokenContrast(page, fg, bg), `${fg} on ${bg}`).toBeGreaterThanOrEqual(min);
});
