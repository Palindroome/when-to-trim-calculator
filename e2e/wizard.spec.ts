// First-run wizard (build only; the prototype has none).
import { expect, test, type Page } from '@playwright/test';
import { readFileSync } from 'node:fs';
import { PROTOTYPE, STORAGE_KEY, WIZARD_KEY, fill, openApp, snapshot, type Snapshot } from './helpers';

test.skip(PROTOTYPE, 'the wizard exists only in the build');

const GOLDEN = JSON.parse(readFileSync(new URL('./golden.json', import.meta.url), 'utf-8')) as Record<string, Snapshot>;

const progress = (page: Page) => page.locator('#wizard-progress');
const next = (page: Page) => page.getByRole('button', { name: 'Dalej' });
const back = (page: Page) => page.getByRole('button', { name: 'Wstecz' });
const finish = (page: Page) => page.getByRole('button', { name: 'Gotowe – pokaż cały formularz' });
const skip = (page: Page) => page.getByRole('button', { name: 'Pomiń – pokaż cały formularz' });
const reopen = (page: Page) => page.getByRole('button', { name: 'Przeprowadź mnie krok po kroku' });
const stored = (page: Page, key: string) => page.evaluate((k) => localStorage.getItem(k), key);
const visibleSections = (page: Page) =>
  page.locator('main > section:visible').evaluateAll((els) =>
    els.map((e) => (e.id ? `#${e.id}` : (e.querySelector('h2')?.textContent ?? e.querySelector('summary')?.textContent ?? '').trim())),
  );
const focusedText = (page: Page) => page.evaluate(() => (document.activeElement?.id ? `#${document.activeElement.id}` : document.activeElement?.textContent?.trim()));
const ALL = ['1Praca', '2Warunki', '3Termin', '#result', '4Sprawdź wagą', '5Moje prace i kalibracja', 'Jak to liczy (i czego jeszcze nie umie)'];

test('first visit starts at step 1 with only that section, progress announced politely', async ({ page }) => {
  await openApp(page, { wizard: true });
  expect(await visibleSections(page)).toEqual(['1Praca']);
  await expect(progress(page)).toHaveText('Krok 1 z 4: Praca');
  await expect(progress(page)).toHaveAttribute('aria-live', 'polite');
  await expect(back(page)).toBeHidden();
  await expect(skip(page)).toBeVisible();
  await expect(reopen(page)).toBeHidden();
});

test('Dalej / Wstecz walk the steps by keyboard, focus moves to each step heading', async ({ page }) => {
  await openApp(page, { wizard: true });
  const steps: [string, string, string][] = [
    ['2Warunki', 'Krok 2 z 4: Warunki', '2Warunki'],
    ['3Termin', 'Krok 3 z 4: Termin', '3Termin'],
    ['#result', 'Krok 4 z 4: Wynik', '#result'],
  ];
  for (const [section, text, focused] of steps) {
    await next(page).focus();
    await page.keyboard.press('Enter');
    expect(await visibleSections(page)).toEqual([section]);
    await expect(progress(page)).toHaveText(text);
    expect(await focusedText(page)).toBe(focused);
  }
  await expect(next(page)).toHaveCount(0);
  await expect(finish(page)).toBeVisible();
  await expect(skip(page)).toBeVisible();
  await back(page).click();
  expect(await visibleSections(page)).toEqual(['3Termin']);
  expect(await focusedText(page)).toBe('3Termin');
});

test('the result step shows the same result as the full form', async ({ page }) => {
  await openApp(page, { wizard: true });
  for (let i = 0; i < 3; i++) await next(page).click();
  expect(await snapshot(page)).toEqual(GOLDEN['defaults']);
});

test('inputs entered in the steps drive the result', async ({ page }) => {
  await openApp(page, { wizard: true });
  await fill(page, 'Masa po toczeniu', '2000');
  await next(page).click();
  await next(page).click();
  await next(page).click();
  expect(await snapshot(page)).toEqual(GOLDEN['mass 2000']);
});

test('finishing shows the full form and is remembered without touching saved pieces', async ({ page }) => {
  await openApp(page, { wizard: true });
  for (let i = 0; i < 3; i++) await next(page).click();
  await finish(page).click();
  expect(await visibleSections(page)).toEqual(ALL);
  expect(await focusedText(page)).toBe('#result');
  expect(await stored(page, WIZARD_KEY)).toBe('done');
  expect(await stored(page, STORAGE_KEY)).toBeNull();
  await page.reload();
  await expect(page.locator('#result .bar')).toHaveCount(5);
  expect(await visibleSections(page)).toEqual(ALL);
  await expect(reopen(page)).toBeVisible();
});

test('skipping at any step shows the full form and is remembered', async ({ page }) => {
  await openApp(page, { wizard: true });
  await next(page).click();
  await skip(page).click();
  expect(await visibleSections(page)).toEqual(ALL);
  expect(await focusedText(page)).toBe('1Praca');
  expect(await stored(page, WIZARD_KEY)).toBe('skipped');
});

test('saving a piece from the result step ends the wizard', async ({ page }) => {
  await openApp(page, { wizard: true });
  for (let i = 0; i < 3; i++) await next(page).click();
  await page.getByRole('button', { name: 'Zapisz tę pracę z planem' }).click();
  expect(await visibleSections(page)).toEqual(ALL);
  await expect(page.locator('#pieces .piece')).toHaveCount(1);
  expect(await stored(page, WIZARD_KEY)).toBe('done');
});

test('the wizard can be re-opened from the full form', async ({ page }) => {
  await openApp(page);
  expect(await visibleSections(page)).toEqual(ALL);
  await reopen(page).click();
  expect(await visibleSections(page)).toEqual(['1Praca']);
  await expect(progress(page)).toHaveText('Krok 1 z 4: Praca');
  expect(await focusedText(page)).toBe('1Praca');
});

for (const width of [320, 375, 1280]) {
  test(`${width}px: every step fits without horizontal scroll, controls 44px high`, async ({ page }) => {
    await page.setViewportSize({ width, height: 800 });
    await openApp(page, { wizard: true });
    for (let i = 0; i < 4; i++) {
      const { scrollWidth, clientWidth } = await page.evaluate(() => ({
        scrollWidth: document.documentElement.scrollWidth,
        clientWidth: document.documentElement.clientWidth,
      }));
      expect(scrollWidth).toBeLessThanOrEqual(clientWidth);
      for (const b of await page.locator('.wizard-nav button:visible').all()) {
        const h = (await b.boundingBox())!.height;
        expect(h).toBeGreaterThanOrEqual(44);
        expect(h).toBeLessThan(60); // labels fit on one line (the nav wraps instead)
      }
      if (i < 3) await next(page).click();
    }
  });
}
