// English UI and the PL | EN switch.
import { expect, test, type Page } from '@playwright/test';
import { STORAGE_KEY, choose, fill, openApp, setNight, snapshot } from './helpers';

const LANG_KEY = 'kiedy-trymowac-lang';
const SAVE_EN = 'Save this piece with its plan';

const langButton = (page: Page, name: 'Polski' | 'English') => page.getByRole('button', { name, exact: true });
const toEnglish = async (page: Page): Promise<void> => {
  await langButton(page, 'English').click();
  await expect(page.locator('html')).toHaveAttribute('lang', 'en');
};
const storedRaw = (page: Page, key: string) => page.evaluate((k) => localStorage.getItem(k), key);

const DEFAULTS_EN = {
  kind: 'Recommendation',
  big: 'Leave uncovered for 4 h (until Wed 4 Mar 12:30), then wrap fully in a bag.',
  sub: 'Ready around Fri 6 Mar 09:59: the target is a loss of about 6.0% of the mass (30 g).',
  win: 'Window: Thu 5 Mar 12:09 → Sat 7 Mar 18:43',
  bars: [
    'Uncovered 6 h',
    'Loosely bagged 1 d',
    'Damp room only if it must stay very wet or for waits of 4+ days 3 d 15 h',
    'Fully bagged 5 d 11 h',
    'Closed box 7 d 15 h+',
  ],
  tracks: [
    '3.125% | target 26.7273%',
    '13.1762% | target 26.7273%',
    '47.5961% | target 26.7273%',
    '71.4286% | target 26.7273%',
    '100% | target 26.7273%',
  ],
  legend:
    'The vertical line is your deadline (2 d 1 h). The number next to a name is how many pieces have calibrated that option.',
  alts: [
    'Leave uncovered for 4 h (until Wed 4 Mar 13:15), then put in a closed box.',
    'Cover loosely with a bag (base or rim exposed) for 19 h (until Thu 5 Mar 03:30), then wrap fully in a bag.',
    'Cover loosely with a bag (base or rim exposed) for 20 h (until Thu 5 Mar 05:14), then put in a closed box.',
  ],
  tips: [],
  save: true,
};

test.describe('language switch', () => {
  test('switching to English translates the page without a reload', async ({ page }) => {
    await openApp(page);
    await page.evaluate(() => ((window as unknown as { marker: number }).marker = 1));
    await toEnglish(page);
    expect(await page.evaluate(() => (window as unknown as { marker?: number }).marker)).toBe(1);
    await expect(page).toHaveTitle('When to trim? – prototype');
    await expect(page.getByRole('heading', { level: 1 })).toHaveText('When to trim?');
    await expect(page.getByRole('heading', { level: 2 })).toHaveText([
      '1Piece',
      '2Conditions',
      '3Timing',
      'How long each option takes',
      '4Check by weight',
      '5My pieces and calibration',
    ]);
    await expect(page.locator('#quick .chip')).toHaveText(['tomorrow', 'in 2 days', 'in 3 days', 'in 5 days', 'in a week']);
    await expect(page.locator('#pieces')).toContainText('No saved pieces yet.');
    expect(await snapshot(page, SAVE_EN)).toEqual(DEFAULTS_EN);
    // no Polish letters left anywhere in the rendered text
    expect(await page.locator('main').innerText()).not.toMatch(/[ąćęłńóśźż]/i);

    await langButton(page, 'Polski').click();
    await expect(page.locator('html')).toHaveAttribute('lang', 'pl');
    await expect(page).toHaveTitle('Kiedy trymować? – prototyp');
    await expect(page.getByRole('heading', { level: 1 })).toHaveText('Kiedy trymować?');
  });

  test('typed values and the quick date survive a switch; the numbers do not change', async ({ page }) => {
    await openApp(page);
    await fill(page, 'Nazwa (opcjonalnie)', 'kubki');
    await fill(page, 'Masa po toczeniu', '720,5');
    await choose(page, 'Kształt', 'bowl');
    await fill(page, 'Temperatura w pracowni', '23');
    await setNight(page, true);
    await fill(page, 'Temperatura nocą (22–7)', '12');
    await page.locator('#quick').getByRole('button', { name: 'za 3 dni' }).click();
    await fill(page, 'Masa teraz', '690');
    await choose(page, 'Przez ten czas była', 'partial');
    const polish = await snapshot(page);
    const weightPl = await page.locator('#wout').innerText();

    await toEnglish(page);
    await expect(page.getByLabel('Name (optional)')).toHaveValue('kubki');
    await expect(page.getByLabel('Mass after throwing')).toHaveValue('720,5');
    await expect(page.getByLabel('Shape')).toHaveValue('bowl');
    await expect(page.getByLabel('Studio temperature')).toHaveValue('23');
    await expect(page.getByLabel('Cooler at night (e.g. heating off)')).toBeChecked();
    await expect(page.getByLabel('Night temperature (22–7)')).toBeVisible();
    await expect(page.getByLabel('Night temperature (22–7)')).toHaveValue('12');
    await expect(page.getByLabel('Trim at')).toHaveValue('2026-03-07T10:00');
    await expect(page.locator('#quick .chip.on')).toHaveText(['in 3 days']);
    await expect(page.getByLabel('Mass now')).toHaveValue('690');
    await expect(page.getByLabel('Covering so far')).toHaveValue('partial');
    const english = await snapshot(page, SAVE_EN);
    expect(english.tracks).toEqual(polish.tracks);
    expect(english.alts).toHaveLength(polish.alts.length);
    expect(english.tips).toHaveLength(polish.tips.length);
    await expect(page.locator('#wout')).not.toBeEmpty();

    // back to Polish: exactly the same result as before switching
    await langButton(page, 'Polski').click();
    expect(await snapshot(page)).toEqual(polish);
    expect(await page.locator('#wout').innerText()).toBe(weightPl);
  });

  test('the choice persists across reloads; the pieces store is untouched', async ({ page }) => {
    await openApp(page);
    await page.getByRole('button', { name: 'Zapisz tę pracę z planem' }).click();
    const v1 = await storedRaw(page, STORAGE_KEY);
    expect(v1).not.toBeNull();
    expect(await storedRaw(page, LANG_KEY)).toBeNull();

    await toEnglish(page);
    expect(await storedRaw(page, LANG_KEY)).toBe('en');
    expect(await storedRaw(page, STORAGE_KEY)).toBe(v1);

    await page.reload();
    await expect(page.locator('html')).toHaveAttribute('lang', 'en');
    await expect(page.getByRole('heading', { level: 1 })).toHaveText('When to trim?');
    expect(await storedRaw(page, STORAGE_KEY)).toBe(v1);

    await langButton(page, 'Polski').click();
    expect(await storedRaw(page, LANG_KEY)).toBe('pl');
    await page.reload();
    await expect(page.locator('html')).toHaveAttribute('lang', 'pl');
  });

  test('a piece saved in Polish shows its plan in English after switching', async ({ page }) => {
    await openApp(page);
    await page.getByRole('button', { name: 'Zapisz tę pracę z planem' }).click();
    await page.locator('#quick').getByRole('button', { name: 'jutro' }).click();
    await page.getByRole('button', { name: 'Zapisz tę pracę z planem' }).click();
    await toEnglish(page);
    const pieces = page.locator('#pieces .piece');
    await expect(pieces.locator('b')).toHaveText(['Praca 2', 'Praca 1']);
    await expect(pieces.locator('.meta')).toHaveText([
      'Cover loosely with a bag (base or rim exposed) straight away.Thrown Wed 4 Mar 09:00 · forecast Thu 5 Mar 09:09',
      'Leave uncovered for 4 h (until Wed 4 Mar 12:30), then wrap fully in a bag.Thrown Wed 4 Mar 09:00 · forecast Fri 6 Mar 09:59',
    ]);
    await expect(pieces.nth(1).locator('.badge')).toHaveText('in 2 d 1 h');
    await expect(pieces.nth(1).getByRole('button')).toHaveText(['too wet', 'just right', 'too dry', 'delete']);
    // the stored label stays in the language it was saved in
    const data = JSON.parse((await storedRaw(page, STORAGE_KEY)) ?? 'null');
    expect(data.pieces[1].label).toBe('Zostaw odkrytą na 4 h (do śr 4.03 12:30), potem zawiń całą w worek.');
  });

  test('feedback and calibration keep working in English', async ({ page }) => {
    await openApp(page);
    await toEnglish(page);
    await page.getByRole('button', { name: SAVE_EN }).click();
    await page.clock.setFixedTime(new Date('2026-03-06T11:00:00+01:00'));
    await page.getByRole('button', { name: 'just right' }).click();
    await expect(page.locator('#pieces .badge')).toHaveText('just right · after 2 d 2 h');
    await expect(page.locator('#pieces b')).toHaveText('Piece 1');
    await expect(page.locator('#calib tr')).toHaveText(['OptionTime multiplierPieces', 'Fully bagged× 1.011']);
    await langButton(page, 'Polski').click();
    await expect(page.locator('#calib tr')).toHaveText(['WariantMnożnik czasuPrace', 'Cały worek× 1,011']);
  });

  test('keyboard operable, with pressed state and accessible names', async ({ page }) => {
    await openApp(page);
    const group = page.getByRole('group', { name: 'Język' });
    await expect(group.getByRole('button')).toHaveText(['PL', 'EN']);
    await expect(langButton(page, 'Polski')).toHaveAttribute('aria-pressed', 'true');
    await expect(langButton(page, 'English')).toHaveAttribute('aria-pressed', 'false');
    await expect(langButton(page, 'Polski')).toHaveAttribute('lang', 'pl');
    await expect(langButton(page, 'English')).toHaveAttribute('lang', 'en');

    await langButton(page, 'English').focus();
    await page.keyboard.press('Enter');
    await expect(page.locator('html')).toHaveAttribute('lang', 'en');
    await expect(page.getByRole('group', { name: 'Language' })).toBeVisible();
    await expect(langButton(page, 'English')).toHaveAttribute('aria-pressed', 'true');
    await expect(langButton(page, 'English')).toBeFocused();

    await page.keyboard.press('Shift+Tab');
    await expect(langButton(page, 'Polski')).toBeFocused();
    await page.keyboard.press('Space');
    await expect(page.locator('html')).toHaveAttribute('lang', 'pl');
    await expect(langButton(page, 'Polski')).toHaveAttribute('aria-pressed', 'true');
    await expect(langButton(page, 'Polski')).toBeFocused();
  });

  for (const [width, height] of [[320, 640], [375, 812], [1280, 900]] as const) {
    test(`${width}px: the switch is at the top, large enough, and nothing overflows`, async ({ page }) => {
      await page.setViewportSize({ width, height });
      await openApp(page);
      for (const lang of ['pl', 'en']) {
        if (lang === 'en') await toEnglish(page);
        const h1 = (await page.getByRole('heading', { level: 1 }).boundingBox())!;
        for (const name of ['Polski', 'English'] as const) {
          const b = (await langButton(page, name).boundingBox())!;
          expect(b.width).toBeGreaterThanOrEqual(24);
          expect(b.height).toBeGreaterThanOrEqual(24);
          expect(b.x + b.width).toBeLessThanOrEqual(width);
          // top right: on the heading's row, or above it when it wraps
          expect(b.y).toBeLessThanOrEqual(h1.y + h1.height);
          expect(b.x).toBeGreaterThan(width / 2);
        }
        const { scrollWidth, clientWidth } = await page.evaluate(() => ({
          scrollWidth: document.documentElement.scrollWidth,
          clientWidth: document.documentElement.clientWidth,
        }));
        expect(scrollWidth).toBeLessThanOrEqual(clientWidth);
      }
    });
  }
});

test.describe('initial language', () => {
  test.describe('English browser', () => {
    test.use({ locale: 'en-US' });

    test('starts in English without storing a choice', async ({ page }) => {
      await openApp(page);
      await expect(page.locator('html')).toHaveAttribute('lang', 'en');
      await expect(page).toHaveTitle('When to trim? – prototype');
      expect(await snapshot(page, SAVE_EN)).toEqual(DEFAULTS_EN);
      expect(await storedRaw(page, LANG_KEY)).toBeNull();
    });

    test('stays Polish for an existing user with saved pieces', async ({ page }) => {
      const start = new Date('2026-03-01T12:00:00+01:00').getTime();
      const data = {
        pieces: [
          {
            id: 'abc', name: 'miski', start, mass: 800, lossPct: 6,
            plan: [{ w: 'box', h: null }], label: 'Włóż do zamkniętego pudełka od razu.', dom: 'box',
            predH: 100, calUsed: 1, ws: 90, we: 120, fb: null,
          },
        ],
      };
      await openApp(page, { storage: JSON.stringify(data) });
      await expect(page.locator('html')).toHaveAttribute('lang', 'pl');
      await expect(page.locator('#pieces .meta')).toContainText('Włóż do zamkniętego pudełka od razu.');
      expect(await storedRaw(page, LANG_KEY)).toBeNull();
    });

    test('a stored choice wins over the browser language', async ({ page }) => {
      await page.addInitScript((k) => localStorage.setItem(k, 'pl'), LANG_KEY);
      await openApp(page);
      await expect(page.locator('html')).toHaveAttribute('lang', 'pl');
    });

    test('a garbage stored value is ignored', async ({ page }) => {
      await page.addInitScript((k) => localStorage.setItem(k, 'klingon'), LANG_KEY);
      await openApp(page);
      await expect(page.locator('html')).toHaveAttribute('lang', 'en');
    });
  });

  for (const locale of ['pl-PL', 'de-DE']) {
    test.describe(`${locale} browser`, () => {
      test.use({ locale });

      test('starts in Polish without storing a choice', async ({ page }) => {
        await openApp(page);
        await expect(page.locator('html')).toHaveAttribute('lang', 'pl');
        await expect(page.getByRole('heading', { level: 1 })).toHaveText('Kiedy trymować?');
        expect(await storedRaw(page, LANG_KEY)).toBeNull();
      });
    });
  }

  test.describe('German browser with a stored English choice', () => {
    test.use({ locale: 'de-DE' });

    test('starts in English', async ({ page }) => {
      await page.addInitScript((k) => localStorage.setItem(k, 'en'), LANG_KEY);
      await openApp(page);
      await expect(page.locator('html')).toHaveAttribute('lang', 'en');
      await expect(page.getByRole('heading', { level: 1 })).toHaveText('When to trim?');
    });
  });
});
