// A reload within the idle window brings back the page as it was left in this tab.
import { expect, type Page, test } from '@playwright/test';
import { choose, fill, NOW, openApp, STORAGE_KEY, setNight, snapshot } from './helpers';

const SESSION_KEY = 'kiedy-trymowac-session';
const MIN = 60 * 1000;
const at = (offsetMin: number): Date => new Date(Date.parse(NOW) + offsetMin * MIN);

const screen = (page: Page) => page.locator('.welcome-screen');
const heading = (page: Page) => page.getByRole('heading', { name: 'Zaplanuj suszenie pracy' });
const backToWelcome = (page: Page) =>
  page.locator('.wizard-bar').getByRole('button', { name: 'Nowa praca' });
const newPiece = (page: Page) => screen(page).getByRole('button', { name: 'Nowa praca' });
const myPieces = (page: Page) => page.getByRole('button', { name: /^Moje prace \(\d+\)$/ });
const progress = (page: Page) => page.locator('#wizard-progress');
const next = (page: Page) => page.getByRole('button', { name: 'Dalej' });

const DATA = JSON.stringify({
  pieces: [
    {
      id: 'abc',
      name: 'miski',
      start: Date.parse('2026-03-03T12:00:00+01:00'),
      mass: 800,
      lossPct: 6,
      plan: [{ w: 'box', h: null }],
      label: 'Włóż do zamkniętego pudełka od razu.',
      dom: 'box',
      predH: 100,
      calUsed: 1,
      ws: 90,
      we: 120,
      fb: null,
    },
  ],
});

/** Every input and select of the form with its value and tick, plus the pressed quick choices. */
const formValues = (page: Page) =>
  page.evaluate(() => ({
    fields: [...document.querySelectorAll<HTMLInputElement>('main input[id], main select')].map(
      (e) => `${e.id}=${e.value}${e.type === 'checkbox' ? `:${e.checked}` : ''}`,
    ),
    covers: [...document.querySelectorAll<HTMLInputElement>('input[data-cover]')].map(
      (e) => e.checked,
    ),
    chips: [...document.querySelectorAll<HTMLElement>('.chip.on')].map((e) => e.textContent),
    days: [...document.querySelectorAll('.day-btn')].map((e) => e.textContent?.trim()),
  }));

async function reload(page: Page): Promise<void> {
  await page.reload();
  await expect(page.locator('#result .bar')).toHaveCount(5);
}

async function fillForm(page: Page): Promise<void> {
  await fill(page, 'Nazwa (opcjonalnie)', 'kubki');
  await fill(page, 'Masa po toczeniu', '720');
  await choose(page, 'Kształt', 'bowl');
  await fill(page, 'Temperatura w pracowni', '24');
  await setNight(page, true);
  await page.locator('#thrown-quick .chip[data-preset="morning"]').click();
  await page.locator('#quick .chip[data-d="3"]').click();
  await page.locator('input[data-cover]').nth(4).uncheck();
}

test.describe('reload within the idle window', () => {
  test('the welcome screen stays shown, with its pieces list expanded', async ({ page }) => {
    await openApp(page, { storage: DATA });
    await backToWelcome(page).click();
    await myPieces(page).click();
    await page.clock.setFixedTime(at(30));
    await reload(page);
    await expect(screen(page)).toBeVisible();
    await expect(heading(page)).toBeFocused();
    await expect(page.locator('main > section:visible')).toHaveCount(0);
    await expect(myPieces(page)).toHaveAttribute('aria-expanded', 'true');
    await expect(page.locator('#welcome-list > li')).toHaveCount(1);
  });

  test('the calculator keeps its inputs, result and scroll position; the pieces store is untouched', async ({
    page,
  }) => {
    await page.setViewportSize({ width: 375, height: 700 });
    await openApp(page, { storage: DATA });
    await fillForm(page);
    const before = await formValues(page);
    const result = await snapshot(page);
    expect(result.bars).not.toEqual([]);
    await page.evaluate(() => window.scrollTo(0, 900));
    const scrollY = await page.evaluate(() => window.scrollY);
    expect(scrollY).toBeGreaterThan(0);
    await page.clock.setFixedTime(at(10));
    await reload(page);
    await expect(screen(page)).toBeHidden();
    expect(await formValues(page)).toEqual(before);
    expect(await snapshot(page)).toEqual(result);
    await expect.poll(() => page.evaluate(() => window.scrollY)).toBe(scrollY);
    expect(await page.evaluate((k) => localStorage.getItem(k), STORAGE_KEY)).toBe(DATA);
  });

  test('the first-run wizard reopens on the step it was on', async ({ page }) => {
    await openApp(page, { wizard: true });
    await expect(progress(page)).toHaveText('Krok 1 z 3: Praca');
    await next(page).click();
    await expect(progress(page)).toHaveText('Krok 2 z 3: Warunki');
    await reload(page);
    await expect(progress(page)).toHaveText('Krok 2 z 3: Warunki');
    await expect(page.locator('main > section:visible h2')).toHaveText('2Warunki');
  });

  test('a wizard opened from "Nowa praca" reopens on its step too', async ({ page }) => {
    await openApp(page);
    await backToWelcome(page).click();
    await newPiece(page).click();
    await next(page).click();
    await next(page).click();
    await expect(progress(page)).toHaveText('Krok 3 z 3: Termin');
    await reload(page);
    await expect(progress(page)).toHaveText('Krok 3 z 3: Termin');
    await expect(screen(page)).toBeHidden();
  });

  test('a skipped wizard stays closed', async ({ page }) => {
    await openApp(page, { wizard: true });
    await page.getByRole('button', { name: 'Pomiń – pokaż cały formularz' }).click();
    await reload(page);
    await expect(progress(page)).toHaveText('');
    await expect(page.locator('main > section[data-step]:visible')).toHaveCount(3);
  });
});

test.describe('fresh page as before', () => {
  test('after the idle window: welcome screen and the default form', async ({ page }) => {
    await openApp(page);
    await fillForm(page);
    await page.clock.setFixedTime(at(61));
    await reload(page);
    await expect(screen(page)).toBeVisible();
    await expect(heading(page)).toBeFocused();
    await expect(page.locator('#mass')).toHaveValue('500');
    await expect(page.locator('#thrown-day')).toHaveValue('2026-03-04');
    await expect(page.locator('#thrown-time')).toHaveValue('10:01');
    await newPiece(page).click();
    await expect(page.locator('#mass')).toHaveValue('500');
  });

  for (const [what, value] of [
    ['unparseable', '{'],
    ['malformed', JSON.stringify({ screen: 'welcome' })],
    [
      'from an older page (unknown field)',
      JSON.stringify({
        screen: 'welcome',
        piecesListed: false,
        form: {
          fields: [{ id: 'gone', value: '1', checked: false }],
          dates: {},
          allowed: [],
        },
        wizardStep: null,
        scrollY: 0,
      }),
    ],
  ] as const) {
    test(`a ${what} snapshot gives the default form`, async ({ page }) => {
      const errors: string[] = [];
      page.on('pageerror', (e) => errors.push(e.message));
      await page.addInitScript(
        ([key, v]) => {
          if (!sessionStorage.getItem('__session-seeded')) {
            sessionStorage.setItem(key, v);
            sessionStorage.setItem('__session-seeded', '1');
          }
        },
        [SESSION_KEY, value] as const,
      );
      await openApp(page);
      await expect(screen(page)).toBeHidden();
      await expect(page.locator('#mass')).toHaveValue('500');
      await expect(page.locator('#mass')).toBeVisible();
      expect(errors).toEqual([]);
    });
  }

  test('without a snapshot (a new tab) the default form, as before', async ({ page }) => {
    await openApp(page);
    await fill(page, 'Masa po toczeniu', '720');
    await page.evaluate((k) => sessionStorage.removeItem(k), SESSION_KEY);
    // the reload itself saves a snapshot on pagehide: drop that one too
    await page.addInitScript((k) => sessionStorage.removeItem(k), SESSION_KEY);
    await reload(page);
    await expect(screen(page)).toBeHidden();
    await expect(page.locator('#mass')).toHaveValue('500');
  });

  test('a failing session storage does not break the page', async ({ page }) => {
    const errors: string[] = [];
    page.on('pageerror', (e) => errors.push(e.message));
    await page.addInitScript(() => {
      const { getItem, setItem } = Storage.prototype;
      const blocked = (s: Storage, k: string) => s === sessionStorage && k.startsWith('kiedy-');
      Storage.prototype.getItem = function (k) {
        if (blocked(this, k)) throw new Error('denied');
        return getItem.call(this, k);
      };
      Storage.prototype.setItem = function (k, v) {
        if (blocked(this, k)) throw new Error('quota');
        setItem.call(this, k, v);
      };
    });
    await openApp(page);
    await fill(page, 'Masa po toczeniu', '720');
    await reload(page);
    await expect(page.locator('#mass')).toHaveValue('500');
    await fill(page, 'Masa po toczeniu', '650');
    await expect(page.locator('#result .bar')).toHaveCount(5);
    expect(errors).toEqual([]);
  });
});
