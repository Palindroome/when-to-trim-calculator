import { expect, test } from '@playwright/test';
import { choose, fill, openApp } from './helpers';

const out = (page: import('@playwright/test').Page) => page.locator('#wout');
const state = (page: import('@playwright/test').Page) => page.locator('#wout .state');

const WINDOW = 'jest w oknie trymowania. Jeśli trymujesz później, zawiń ją w worek.';
const HARD = 'prawdopodobnie już za twarda na gładkie trymowanie. Spróbuj zawinąć ją z wilgotną gąbką na kilka godzin.';

test.describe('weight check', () => {
  test('hint text is shown', async ({ page }) => {
    await openApp(page);
    await expect(page.getByText('Zważ pracę (bez batu) przy toczeniu i teraz.', { exact: false })).toBeVisible();
  });

  test('nothing is shown until a current mass is entered', async ({ page }) => {
    await openApp(page);
    await expect(out(page)).toBeEmpty();
  });

  // Defaults: 500 g stoneware, target 6% loss, window 5% .. 7.5%. Thrown "now" => elapsed 0,
  // so the "still soft" message estimates with the selected wrap (default: open).
  const cases: [string, 'wet' | 'ok' | 'dry', string][] = [
    ['470', 'ok', `Utrata 6,0%: ${WINDOW}`],
    ['475', 'ok', `Utrata 5,0%: ${WINDOW}`], // lower edge is inclusive
    ['462.5', 'ok', `Utrata 7,5%: ${WINDOW}`], // upper edge is inclusive
    ['462', 'dry', `Utrata 7,6%: ${HARD}`],
    ['460', 'dry', `Utrata 8,0%: ${HARD}`],
    ['490', 'wet', 'Utrata 2,0%: jeszcze za miękka. W tym opatuleniu potrzeba jeszcze ok. 4 h.'],
    ['500', 'wet', 'Utrata 0,0%: jeszcze za miękka. W tym opatuleniu potrzeba jeszcze ok. 6 h.'],
    ['520', 'wet', 'Utrata -4,0%: jeszcze za miękka. W tym opatuleniu potrzeba jeszcze ok. 10 h.'],
  ];
  for (const [mass, cls, msg] of cases) {
    test(`mass now ${mass} g -> ${cls}`, async ({ page }) => {
      await openApp(page);
      await fill(page, 'Masa teraz', mass);
      await expect(state(page)).toHaveText(msg);
      await expect(state(page)).toHaveClass(`state ${cls}`);
    });
  }

  test('zero or empty current mass clears the output', async ({ page }) => {
    await openApp(page);
    await fill(page, 'Masa teraz', '470');
    await expect(state(page)).toHaveCount(1);
    await fill(page, 'Masa teraz', '0');
    await expect(out(page)).toBeEmpty();
    await fill(page, 'Masa teraz', '470');
    await fill(page, 'Masa teraz', '');
    await expect(out(page)).toBeEmpty();
  });

  const wraps: [string, string][] = [
    ['open', '4 h'],
    ['partial', '16 h'],
    ['damp', '2 d 10 h'],
    ['full', '3 d 15 h'],
    ['box', '5 d 2 h'],
  ];
  for (const [w, eta] of wraps) {
    test(`remaining time with wrap "${w}" right after throwing`, async ({ page }) => {
      await openApp(page);
      await fill(page, 'Masa teraz', '490');
      await choose(page, 'Przez ten czas była', w);
      await expect(state(page)).toHaveText(
        `Utrata 2,0%: jeszcze za miękka. W tym opatuleniu potrzeba jeszcze ok. ${eta}.`,
      );
    });
  }

  test('uses the observed drying rate once more than 30 minutes have passed', async ({ page }) => {
    await openApp(page);
    await fill(page, 'Wytoczona', '2026-03-03T09:00');
    await fill(page, 'Masa teraz', '490');
    await expect(state(page)).toHaveText('Utrata 2,0%: jeszcze za miękka. Przy obecnym tempie (0,4 g/h) zostało ok. 2 d.');
    await fill(page, 'Masa teraz', '480');
    await expect(state(page)).toHaveText('Utrata 4,0%: jeszcze za miękka. Przy obecnym tempie (0,8 g/h) zostało ok. 12 h.');
    // wrap choice is irrelevant once the observed rate is used
    await choose(page, 'Przez ten czas była', 'box');
    await expect(state(page)).toHaveText('Utrata 4,0%: jeszcze za miękka. Przy obecnym tempie (0,8 g/h) zostało ok. 12 h.');
  });

  test('falls back to the model when only 20 minutes have passed', async ({ page }) => {
    await openApp(page);
    await fill(page, 'Wytoczona', '2026-03-04T08:40');
    await fill(page, 'Masa teraz', '480');
    await expect(state(page)).toHaveText('Utrata 4,0%: jeszcze za miękka. W tym opatuleniu potrzeba jeszcze ok. 2 h.');
  });

  test('is recomputed when the piece inputs change', async ({ page }) => {
    await openApp(page);
    await fill(page, 'Masa teraz', '490');
    await fill(page, 'Masa po toczeniu', '600');
    await expect(state(page)).toHaveText(`Utrata 18,3%: ${HARD}`);
    await choose(page, 'Na co ma być gotowa', 'hard');
    // hard: target 8%, window up to 9.5% -> still too hard
    await expect(state(page)).toHaveClass('state dry');
  });

  test('empty thrown mass hides the check (even though the model falls back to 500 g)', async ({ page }) => {
    await openApp(page);
    await fill(page, 'Masa teraz', '490');
    await fill(page, 'Masa po toczeniu', '');
    await expect(out(page)).toBeEmpty();
    await expect(page.locator('.rec .sub')).toContainText('(30 g)');
  });

  test('changing the current mass does not alter the recommendation', async ({ page }) => {
    await openApp(page);
    const before = await page.locator('#result').innerHTML();
    await fill(page, 'Masa teraz', '470');
    await choose(page, 'Przez ten czas była', 'box');
    expect(await page.locator('#result').innerHTML()).toBe(before);
  });
});
