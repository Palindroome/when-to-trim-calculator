// Dark colour scheme and the System | Light | Dark switch (#7).
import { expect, test, type Page } from '@playwright/test';
import { STORAGE_KEY, elementContrast, openApp, tokenContrast, type ElementColor } from './helpers';

const THEME_KEY = 'kiedy-trymowac-theme';
const LANG_KEY = 'kiedy-trymowac-lang';
const BG = { light: '#f4ede3', dark: '#171412' } as const;

const scheme = (page: Page) =>
  page.evaluate(() => {
    const s = getComputedStyle(document.documentElement);
    return {
      colorScheme: s.colorScheme,
      bg: s.getPropertyValue('--bg').trim().toLowerCase(),
      body: getComputedStyle(document.body).backgroundColor,
    };
  });
const themeButton = (page: Page, name: string) =>
  page.getByRole('group', { name: /^(Motyw|Theme)$/ }).getByRole('button', { name, exact: true });
const storedRaw = (page: Page, key: string) => page.evaluate((k) => localStorage.getItem(k), key);
const dataTheme = (page: Page) => page.evaluate(() => document.documentElement.dataset.theme ?? null);

const TOKEN_PAIRS: [string, string, number][] = [
  ['--text', '--bg', 4.5],
  ['--text', '--surface', 4.5],
  ['--text', '--surface-2', 4.5],
  ['--text-muted', '--bg', 4.5],
  ['--text-muted', '--surface', 4.5],
  ['--text-muted', '--surface-2', 4.5],
  ['--accent-contrast', '--accent', 4.5],
  ['--accent-contrast', '--accent-hover', 4.5],
  ['--accent', '--surface', 4.5],
  ['--accent', '--bg', 4.5],
  ['--accent', '--accent-soft', 4.5],
  ['--text', '--accent-soft', 4.5],
  ['--ok', '--ok-soft', 4.5],
  ['--warn', '--warn-soft', 4.5],
  ['--wet', '--wet-soft', 4.5],
  ['--input-border', '--surface', 3],
  ['--input-border', '--bg', 3],
  ['--input-border', '--surface-2', 3],
  ['--ring', '--surface', 3],
  ['--ring', '--bg', 3],
  // comparison bars: fill, on-target fill and deadline marker against the track
  ['--fill', '--track', 3],
  ['--ok', '--track', 3],
  ['--text', '--track', 3],
];

const ELEMENT_PAIRS: [ElementColor, ElementColor, number][] = [
  [['#mass', 'borderTopColor'], ['#mass', 'backgroundColor'], 3],
  [['#mass', 'color'], ['#mass', 'backgroundColor'], 4.5],
  [['#result .fill', 'backgroundColor'], ['#result .track', 'backgroundColor'], 3],
  [['#result .target', 'backgroundColor'], ['#result .track', 'backgroundColor'], 3],
  [['.rec .big', 'color'], ['.rec', 'backgroundColor'], 4.5],
  [['.rec .k', 'color'], ['.rec', 'backgroundColor'], 4.5],
  [['.rec .sub', 'color'], ['.rec', 'backgroundColor'], 4.5],
  [['#savebtn', 'color'], ['#savebtn', 'backgroundColor'], 4.5],
  [['.lead', 'color'], ['body', 'backgroundColor'], 4.5],
  [['.card h2', 'color'], ['.card', 'backgroundColor'], 4.5],
];

for (const colorScheme of ['light', 'dark'] as const) {
  test.describe(`${colorScheme} system scheme, no stored choice`, () => {
    test.use({ colorScheme });

    test('follows the system: color-scheme and tokens', async ({ page }) => {
      await openApp(page);
      expect(await dataTheme(page)).toBeNull();
      const s = await scheme(page);
      expect(s.colorScheme).toBe(colorScheme);
      expect(s.bg).toBe(BG[colorScheme]);
      expect(s.body).toBe(colorScheme === 'dark' ? 'rgb(23, 20, 18)' : 'rgb(244, 237, 227)');
      await expect(themeButton(page, 'Systemowy')).toHaveAttribute('aria-pressed', 'true');
    });

    test('tokens and rendered elements meet WCAG contrast', async ({ page }) => {
      await openApp(page);
      for (const [fg, bg, min] of TOKEN_PAIRS) expect(await tokenContrast(page, fg, bg), `${fg} on ${bg}`).toBeGreaterThanOrEqual(min);
      for (const [fg, bg, min] of ELEMENT_PAIRS) {
        expect(await elementContrast(page, fg, bg), `${fg.join(' ')} on ${bg.join(' ')}`).toBeGreaterThanOrEqual(min);
      }
    });

    test('the primary button label uses --accent-contrast', async ({ page }) => {
      await openApp(page);
      const { label, token } = await page.evaluate(() => {
        const probe = document.createElement('div');
        probe.style.color = 'var(--accent-contrast)';
        document.body.append(probe);
        const token = getComputedStyle(probe).color;
        probe.remove();
        return { label: getComputedStyle(document.querySelector('#savebtn')!).color, token };
      });
      expect(label).toBe(token);
      if (colorScheme === 'dark') expect(label).not.toBe('rgb(255, 255, 255)');
    });
  });
}

test.describe('theme switch', () => {
  test('Dark overrides a light system, Light overrides a dark system, System follows it again', async ({ page }) => {
    await page.emulateMedia({ colorScheme: 'light' });
    await openApp(page);
    await page.evaluate(() => ((window as unknown as { marker: number }).marker = 1));

    await themeButton(page, 'Ciemny').click();
    expect(await dataTheme(page)).toBe('dark');
    expect(await scheme(page)).toMatchObject({ colorScheme: 'dark', bg: BG.dark });
    await expect(themeButton(page, 'Ciemny')).toHaveAttribute('aria-pressed', 'true');
    await expect(themeButton(page, 'Systemowy')).toHaveAttribute('aria-pressed', 'false');
    expect(await storedRaw(page, THEME_KEY)).toBe('dark');

    await page.emulateMedia({ colorScheme: 'dark' });
    await themeButton(page, 'Jasny').click();
    expect(await dataTheme(page)).toBe('light');
    expect(await scheme(page)).toMatchObject({ colorScheme: 'light', bg: BG.light });
    expect(await storedRaw(page, THEME_KEY)).toBe('light');

    await themeButton(page, 'Systemowy').click();
    expect(await dataTheme(page)).toBeNull();
    expect(await scheme(page)).toMatchObject({ colorScheme: 'dark', bg: BG.dark });
    expect(await storedRaw(page, THEME_KEY)).toBeNull();
    await expect(themeButton(page, 'Systemowy')).toHaveAttribute('aria-pressed', 'true');
    // applied in place: no reload
    expect(await page.evaluate(() => (window as unknown as { marker?: number }).marker)).toBe(1);
  });

  test('the choice persists across reloads and is applied before the body is parsed', async ({ page }) => {
    // records data-theme at the moment <body> is inserted, i.e. before anything can be painted
    await page.addInitScript(() => {
      const w = window as unknown as { themeAtBody?: string | null };
      new MutationObserver((_, obs) => {
        if (document.body) {
          w.themeAtBody = document.documentElement.dataset.theme ?? null;
          obs.disconnect();
        }
      }).observe(document, { childList: true, subtree: true });
    });
    await openApp(page);
    await themeButton(page, 'Ciemny').click();
    await page.reload();
    await expect(page.locator('#result .bar')).toHaveCount(5);
    expect(await page.evaluate(() => (window as unknown as { themeAtBody?: string | null }).themeAtBody)).toBe('dark');
    expect(await scheme(page)).toMatchObject({ colorScheme: 'dark', bg: BG.dark });
    await expect(themeButton(page, 'Ciemny')).toHaveAttribute('aria-pressed', 'true');

    await themeButton(page, 'Systemowy').click();
    await page.reload();
    await expect(page.locator('#result .bar')).toHaveCount(5);
    expect(await page.evaluate(() => (window as unknown as { themeAtBody?: string | null }).themeAtBody)).toBeNull();
    expect(await scheme(page)).toMatchObject({ colorScheme: 'light', bg: BG.light });
  });

  test('a garbage stored value falls back to System', async ({ page }) => {
    await page.addInitScript((k) => localStorage.setItem(k, 'sepia'), THEME_KEY);
    await openApp(page);
    expect(await dataTheme(page)).toBeNull();
    await expect(themeButton(page, 'Systemowy')).toHaveAttribute('aria-pressed', 'true');
    expect(await scheme(page)).toMatchObject({ colorScheme: 'light', bg: BG.light });
  });

  test('the pieces store and the language choice are untouched', async ({ page }) => {
    await openApp(page);
    await page.getByRole('button', { name: 'Zapisz tę pracę z planem' }).click();
    await page.getByRole('button', { name: 'English', exact: true }).click();
    const before = { v1: await storedRaw(page, STORAGE_KEY), lang: await storedRaw(page, LANG_KEY) };
    expect(before.v1).not.toBeNull();
    expect(before.lang).toBe('en');
    for (const name of ['Dark', 'Light', 'System', 'Dark']) await themeButton(page, name).click();
    await page.reload();
    await expect(page.locator('#result .bar')).toHaveCount(5);
    expect({ v1: await storedRaw(page, STORAGE_KEY), lang: await storedRaw(page, LANG_KEY) }).toEqual(before);
  });

  test('keyboard operable, with pressed state, catalog names, tooltips and hidden icons', async ({ page }) => {
    await openApp(page);
    const group = page.getByRole('group', { name: 'Motyw' });
    const names = ['Systemowy', 'Jasny', 'Ciemny'];
    for (const name of names) {
      const b = themeButton(page, name);
      await expect(b).toHaveAttribute('title', name);
      await expect(b.locator('svg')).toHaveAttribute('aria-hidden', 'true');
    }
    await expect(group.getByRole('button')).toHaveCount(3);

    // tab order: the language switch first, then the theme switch
    await page.getByRole('button', { name: 'English', exact: true }).focus();
    await page.keyboard.press('Tab');
    await expect(themeButton(page, 'Systemowy')).toBeFocused();
    await page.keyboard.press('Tab');
    await page.keyboard.press('Tab');
    await expect(themeButton(page, 'Ciemny')).toBeFocused();
    await page.keyboard.press('Enter');
    expect(await dataTheme(page)).toBe('dark');
    await expect(themeButton(page, 'Ciemny')).toHaveAttribute('aria-pressed', 'true');
    await page.keyboard.press('Shift+Tab');
    await page.keyboard.press('Space');
    expect(await dataTheme(page)).toBe('light');
    await expect(themeButton(page, 'Jasny')).toHaveAttribute('aria-pressed', 'true');

    // the names follow the language; the choice survives the re-render
    await page.getByRole('button', { name: 'English', exact: true }).click();
    await expect(page.getByRole('group', { name: 'Theme' }).getByRole('button')).toHaveCount(3);
    for (const name of ['System', 'Light', 'Dark']) await expect(themeButton(page, name)).toHaveAttribute('title', name);
    await expect(themeButton(page, 'Light')).toHaveAttribute('aria-pressed', 'true');
    expect(await dataTheme(page)).toBe('light');
  });

  for (const [width, height] of [
    [320, 640],
    [375, 812],
    [1280, 900],
  ] as const) {
    test(`${width}px: the toolbar is top right (language, then theme), targets are large enough, nothing overflows`, async ({ page }) => {
      await page.setViewportSize({ width, height });
      await page.emulateMedia({ colorScheme: 'dark' });
      await openApp(page);
      const box = async (name: string) => (await page.getByRole('group', { name, exact: true }).boundingBox())!;
      const [lang, theme, head, h1] = [
        await box('Język'),
        await box('Motyw'),
        (await page.locator('.masthead').boundingBox())!,
        (await page.getByRole('heading', { level: 1 }).boundingBox())!,
      ];
      expect(theme.x).toBeGreaterThan(lang.x + lang.width - 1);
      expect(Math.abs(theme.x + theme.width - (head.x + head.width))).toBeLessThanOrEqual(1);
      expect(theme.y).toBeLessThanOrEqual(h1.y + h1.height);
      for (const b of await page
        .locator('[data-theme-choice]')
        .evaluateAll((els) => els.map((el) => el.getBoundingClientRect().toJSON()))) {
        expect(b.width).toBeGreaterThanOrEqual(24);
        expect(b.height).toBeGreaterThanOrEqual(24);
      }
      const { scrollWidth, clientWidth } = await page.evaluate(() => ({
        scrollWidth: document.documentElement.scrollWidth,
        clientWidth: document.documentElement.clientWidth,
      }));
      expect(scrollWidth).toBeLessThanOrEqual(clientWidth);
    });
  }
});
