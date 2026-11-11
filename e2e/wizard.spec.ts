// First-run wizard and the summary cards it leads to.

import { readFileSync } from 'node:fs';
import { expect, type Page, test } from '@playwright/test';
import { fill, openApp, type Snapshot, STORAGE_KEY, snapshot, WIZARD_KEY } from './helpers';

const GOLDEN = JSON.parse(readFileSync(new URL('./golden.json', import.meta.url), 'utf-8')) as Record<string, Snapshot>;

const progress = (page: Page) => page.locator('#wizard-progress');
const next = (page: Page) => page.getByRole('button', { name: 'Dalej' });
const back = (page: Page) => page.getByRole('button', { name: 'Wstecz' });
const finish = (page: Page) => page.getByRole('button', { name: 'Pokaż wynik' });
const skip = (page: Page) => page.getByRole('button', { name: 'Pomiń – pokaż cały formularz' });
const newPiece = (page: Page) => page.locator('.wizard-bar').getByRole('button', { name: 'Nowa praca' });
const toggle = (page: Page, n: number) =>
  page
    .locator('main > section[data-step]')
    .nth(n - 1)
    .locator('.toggle');
const summary = (page: Page, n: number) =>
  page
    .locator('main > section[data-step]')
    .nth(n - 1)
    .locator('.summary');
const stored = (page: Page, key: string) => page.evaluate((k) => localStorage.getItem(k), key);
const visibleSections = (page: Page) =>
  page
    .locator('main > section:visible')
    .evaluateAll((els) =>
      els.map((e) => (e.id ? `#${e.id}` : (e.querySelector('h2')?.textContent ?? e.querySelector('summary')?.textContent ?? '').trim())),
    );
const focused = (page: Page) =>
  page.evaluate(() => {
    const a = document.activeElement;
    return a?.id ? `#${a.id}` : (a?.getAttribute('aria-label') ?? a?.textContent?.trim());
  });
const ALL = [
  '1Praca',
  '2Warunki',
  '3Termin',
  '#result',
  '4Sprawdź wagą',
  '5Moje prace i kalibracja',
  'Jak to liczy (i czego jeszcze nie umie)',
];

async function walkThrough(page: Page): Promise<void> {
  await next(page).click();
  await next(page).click();
  await finish(page).click();
}

test.describe('wizard', () => {
  test('first visit starts at step 1 with only that section, progress announced politely', async ({ page }) => {
    await openApp(page, { wizard: true });
    expect(await visibleSections(page)).toEqual(['1Praca']);
    await expect(progress(page)).toHaveText('Krok 1 z 3: Praca');
    await expect(progress(page)).toHaveAttribute('aria-live', 'polite');
    await expect(back(page)).toBeHidden();
    await expect(skip(page)).toBeVisible();
    await expect(newPiece(page)).toBeVisible();
    await expect(page.locator('#wizard-open')).toHaveCount(0);
    await expect(toggle(page, 1)).toBeHidden();
    await expect(summary(page, 1)).toBeHidden();
  });

  test('Dalej / Wstecz walk the three steps by keyboard, focus moves to each step heading', async ({ page }) => {
    await openApp(page, { wizard: true });
    for (const [section, text] of [
      ['2Warunki', 'Krok 2 z 3: Warunki'],
      ['3Termin', 'Krok 3 z 3: Termin'],
    ] as const) {
      await next(page).focus();
      await page.keyboard.press('Enter');
      expect(await visibleSections(page)).toEqual([section]);
      await expect(progress(page)).toHaveText(text);
      expect(await focused(page)).toBe(section);
    }
    await expect(next(page)).toHaveCount(0);
    await expect(finish(page)).toBeVisible();
    await expect(skip(page)).toBeVisible();
    await back(page).click();
    expect(await visibleSections(page)).toEqual(['2Warunki']);
    expect(await focused(page)).toBe('2Warunki');
  });

  test('after step 3 the whole page shows, with sections 1–3 as collapsed summary cards', async ({ page }) => {
    await openApp(page, { wizard: true });
    await walkThrough(page);
    expect(await visibleSections(page)).toEqual(ALL);
    expect(await focused(page)).toBe('#result');
    expect(await snapshot(page)).toEqual(GOLDEN.defaults);
    await expect(summary(page, 1)).toHaveText('Kubek / cylinder · 500 g · ścianka 6 mm, dno 9 mm · Kamionka gładka');
    await expect(summary(page, 2)).toHaveText('20 °C, 50% · Lekki ruch (ludzie, wentylacja)');
    await expect(summary(page, 3)).toHaveText('Wytoczona śr 4.03 09:00 · trymowanie pt 6.03 10:00');
    for (const n of [1, 2, 3]) {
      await expect(toggle(page, n)).toHaveAttribute('aria-expanded', 'false');
      await expect(toggle(page, n)).toHaveText('Zmień');
    }
    await expect(page.locator('#mass')).toBeHidden();
    await expect(page.locator('#when-day-btn')).toBeHidden();
    // sections 4 and 5 stay a normal form
    await expect(page.locator('#mnow')).toBeVisible();
    expect(await stored(page, WIZARD_KEY)).toBe('done');
    expect(await stored(page, STORAGE_KEY)).toBeNull();
  });

  test('on desktop the summary cards sit beside the sticky result', async ({ page }) => {
    await page.setViewportSize({ width: 1280, height: 900 });
    await openApp(page, { wizard: true });
    await walkThrough(page);
    const card = (await page.locator('main > section[data-step]').first().boundingBox())!;
    const result = (await page.locator('#result .rec').boundingBox())!;
    expect(result.x).toBeGreaterThanOrEqual(card.x + card.width);
    expect(card.height).toBeLessThan(150);
  });

  test('inputs entered in the steps drive the result', async ({ page }) => {
    await openApp(page, { wizard: true });
    await fill(page, 'Masa po toczeniu', '2000');
    await walkThrough(page);
    expect(await snapshot(page)).toEqual(GOLDEN['mass 2000']);
    await expect(summary(page, 1)).toContainText('2000 g');
  });

  test('skipping at any step shows the full, expanded form and is remembered', async ({ page }) => {
    await openApp(page, { wizard: true });
    await next(page).click();
    await skip(page).click();
    expect(await visibleSections(page)).toEqual(ALL);
    expect(await focused(page)).toBe('1Praca');
    expect(await stored(page, WIZARD_KEY)).toBe('skipped');
    await expect(page.locator('#mass')).toBeVisible();
    await expect(toggle(page, 1)).toBeHidden();
    await page.reload();
    await expect(page.locator('#mass')).toBeVisible();
    await expect(progress(page)).toBeHidden();
  });

  test('the wizard can be re-opened from the full form through the welcome screen', async ({ page }) => {
    await openApp(page);
    expect(await visibleSections(page)).toEqual(ALL);
    await newPiece(page).click();
    await page.locator('.welcome-screen').getByRole('button', { name: 'Nowa praca' }).click();
    expect(await visibleSections(page)).toEqual(['1Praca']);
    await expect(progress(page)).toHaveText('Krok 1 z 3: Praca');
    expect(await focused(page)).toBe('1Praca');
    await walkThrough(page);
    await expect(toggle(page, 1)).toHaveAttribute('aria-expanded', 'false');
  });
});

test.describe('summary cards', () => {
  test('clicking a card opens its fields; edits update the result live and the summary after collapsing', async ({ page }) => {
    await openApp(page, { wizard: true });
    await walkThrough(page);
    // anywhere on the collapsed card (here: its summary line) opens it
    await page
      .locator('main > section[data-step]')
      .first()
      .click({ position: { x: 40, y: 70 } });
    await expect(toggle(page, 1)).toHaveAttribute('aria-expanded', 'true');
    await expect(toggle(page, 1)).toHaveText('Zwiń');
    await expect(toggle(page, 1)).toHaveAttribute('aria-label', 'Zwiń: Praca');
    await expect(summary(page, 1)).toBeHidden();
    await expect(toggle(page, 2)).toHaveAttribute('aria-expanded', 'false');
    await fill(page, 'Masa po toczeniu', '2000');
    expect(await snapshot(page)).toEqual(GOLDEN['mass 2000']);
    await toggle(page, 1).click();
    await expect(page.locator('#mass')).toBeHidden();
    await expect(summary(page, 1)).toContainText('2000 g');
  });

  test('a card opens and closes from the keyboard and keeps focus on its toggle', async ({ page }) => {
    await openApp(page, { wizard: true });
    await walkThrough(page);
    await toggle(page, 3).focus();
    await expect(toggle(page, 3)).toHaveAttribute('aria-label', 'Zmień: Termin');
    await page.keyboard.press('Enter');
    await expect(page.locator('#when-day-btn')).toBeVisible();
    expect(await focused(page)).toBe('Zwiń: Termin');
    await page.keyboard.press('Space');
    await expect(page.locator('#when-day-btn')).toBeHidden();
    expect(await focused(page)).toBe('Zmień: Termin');
  });

  test('returning after finishing the wizard shows the collapsed cards again', async ({ page }) => {
    await openApp(page, { wizard: true });
    await walkThrough(page);
    await page.reload();
    await expect(page.locator('#result .bar')).toHaveCount(5);
    expect(await visibleSections(page)).toEqual(ALL);
    await expect(toggle(page, 1)).toHaveAttribute('aria-expanded', 'false');
    await expect(summary(page, 2)).toBeVisible();
  });

  test('a language switch keeps the cards and their state', async ({ page }) => {
    await openApp(page, { wizard: true });
    await walkThrough(page);
    await toggle(page, 2).click();
    await page.getByRole('button', { name: 'English' }).click();
    await expect(toggle(page, 1)).toHaveText('Edit');
    await expect(toggle(page, 2)).toHaveText('Collapse');
    await expect(summary(page, 3)).toHaveText('Thrown Wed 4 Mar 09:00 · trim Fri 6 Mar 10:00');
  });
});

for (const width of [320, 375, 1280]) {
  test(`${width}px: wizard steps and summary cards fit without horizontal scroll`, async ({ page }) => {
    await page.setViewportSize({ width, height: 800 });
    await openApp(page, { wizard: true });
    const noScroll = async (): Promise<void> => {
      const { scrollWidth, clientWidth } = await page.evaluate(() => ({
        scrollWidth: document.documentElement.scrollWidth,
        clientWidth: document.documentElement.clientWidth,
      }));
      expect(scrollWidth).toBeLessThanOrEqual(clientWidth);
    };
    for (let i = 0; i < 3; i++) {
      await noScroll();
      for (const b of await page.locator('.wizard-nav button:visible').all()) {
        const h = (await b.boundingBox())!.height;
        expect(h).toBeGreaterThanOrEqual(44);
        expect(h).toBeLessThan(60); // labels fit on one line (the nav wraps instead)
      }
      await (i < 2 ? next(page) : finish(page)).click();
    }
    await noScroll();
    await toggle(page, 1).click();
    await noScroll();
  });
}
