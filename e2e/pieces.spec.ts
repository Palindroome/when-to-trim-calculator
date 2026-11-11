import { expect, test, type Page } from '@playwright/test';
import { STORAGE_KEY, expectDateTime, fill, openApp, setDateTime, snapshot } from './helpers';

const EMPTY =
  'Nie ma jeszcze zapisanych prac. Zapisz pracę z planem, a gdy będziesz ją trymować, oceń, jak trafiła prognoza. Po kilku ocenach czasy dopasują się do Twojej pracowni.';
const DEFAULT_PLAN = 'Zostaw odkrytą na 4 h (do śr 4.03 12:30), potem zawiń całą w worek.';

const pieces = (page: Page) => page.locator('#pieces .piece');
const saveBtn = (page: Page) => page.getByRole('button', { name: 'Zapisz tę pracę z planem' });
const stored = (page: Page) => page.evaluate((k) => JSON.parse(localStorage.getItem(k) ?? 'null'), STORAGE_KEY);

async function at(page: Page, iso: string) {
  await page.clock.setFixedTime(new Date(iso));
}

test.describe('saved pieces', () => {
  test('empty state', async ({ page }) => {
    await openApp(page);
    await expect(page.locator('#pieces')).toHaveText(EMPTY);
    await expect(page.locator('#calib')).toBeEmpty();
    await expect(page.locator('#calib table')).toHaveCount(0);
  });

  test('saving a named piece stores the plan and lists it', async ({ page }) => {
    await openApp(page);
    await fill(page, 'Nazwa (opcjonalnie)', '  kubki z czwartku  ');
    await saveBtn(page).click();
    await expect(pieces(page)).toHaveCount(1);
    const p = pieces(page).first();
    await expect(p.locator('b')).toHaveText('kubki z czwartku');
    await expect(p.locator('.badge')).toHaveText('za 2 d 1 h');
    await expect(p.locator('.meta')).toHaveText(`${DEFAULT_PLAN}Toczona śr 4.03 09:00 · prognoza pt 6.03 09:59`);
    await expect(p.getByRole('button')).toHaveText(['za mokra', 'w sam raz', 'za sucha', 'usuń']);
    await expect(p.getByText('Trymuję teraz i jest:')).toBeVisible();

    const data = await stored(page);
    expect(data.pieces).toHaveLength(1);
    const s = data.pieces[0];
    expect(s).toMatchObject({
      id: new Date('2026-03-04T09:00:00+01:00').getTime().toString(36),
      name: 'kubki z czwartku',
      start: new Date('2026-03-04T09:00:00+01:00').getTime(),
      mass: 500,
      lossPct: 6,
      label: DEFAULT_PLAN,
      dom: 'full',
      calUsed: 1,
      fb: null,
    });
    expect(s.plan).toHaveLength(2);
    expect(s.plan[0].w).toBe('open');
    expect(s.plan[0].h).toBeCloseTo(3.5, 6);
    expect(s.plan[1]).toEqual({ w: 'full', h: null });
    expect(s.predH).toBeCloseTo(48.988012, 4);
    expect(s.ws).toBeCloseTo(27.162629, 4);
    expect(s.we).toBeCloseTo(81.726087, 4);
    expect(Object.keys(s).sort()).toEqual(
      ['id', 'name', 'start', 'mass', 'lossPct', 'plan', 'label', 'dom', 'predH', 'calUsed', 'ws', 'we', 'fb'].sort(),
    );
  });

  test('unnamed pieces get numbered names and the newest is first', async ({ page }) => {
    await openApp(page);
    await saveBtn(page).click();
    await at(page, '2026-03-04T09:01:00+01:00');
    await page.getByRole('button', { name: 'jutro' }).click();
    await saveBtn(page).click();
    await expect(pieces(page).locator('b')).toHaveText(['Praca 2', 'Praca 1']);
    await expect(pieces(page).first().locator('.meta')).toContainText('Przykryj luźno workiem (dno lub brzeg odsłonięte) od razu.');
    // single-wrap plan: stored with h:null and dominant = that wrap
    const data = await stored(page);
    expect(data.pieces[0].plan).toEqual([{ w: 'partial', h: null }]);
    expect(data.pieces[0].dom).toBe('partial');
  });

  test('pieces survive a reload; badge counts down from the current time', async ({ page }) => {
    await openApp(page);
    await saveBtn(page).click();
    await at(page, '2026-03-05T21:00:00+01:00');
    await page.reload();
    await expect(pieces(page).locator('.badge')).toHaveText('za 13 h');
    await at(page, '2026-03-06T11:00:00+01:00');
    await page.reload();
    await expect(pieces(page).locator('.badge')).toHaveText('powinna być gotowa');
    // thrown date resets to "now" on reload (it is not persisted)
    await expectDateTime(page, 'Wytoczona', '2026-03-06T11:00');
  });

  test('feedback within the first 15 minutes is ignored', async ({ page }) => {
    await openApp(page);
    await saveBtn(page).click();
    await at(page, '2026-03-04T09:15:00+01:00');
    await page.getByRole('button', { name: 'w sam raz' }).click();
    await expect(pieces(page).locator('.badge')).toHaveText('za 2 d 1 h');
    expect((await stored(page)).pieces[0].fb).toBeNull();
    await at(page, '2026-03-04T09:16:00+01:00');
    await page.getByRole('button', { name: 'w sam raz' }).click();
    await expect(pieces(page).locator('.badge')).toHaveText('w sam raz · po 16 min');
  });

  const fbCases: [string, string, string, string][] = [
    ['za mokra', 'wet', 'była za mokra · po 2 d 2 h', '× 1,07'],
    ['w sam raz', 'ok', 'w sam raz · po 2 d 2 h', '× 1,01'],
    ['za sucha', 'dry', 'była za sucha · po 2 d 2 h', '× 0,93'],
  ];
  for (const [button, kind, badge, mult] of fbCases) {
    test(`feedback "${button}" calibrates the dominant wrap`, async ({ page }) => {
      await openApp(page);
      await saveBtn(page).click();
      await at(page, '2026-03-06T11:00:00+01:00');
      await page.getByRole('button', { name: button }).click();
      const p = pieces(page).first();
      await expect(p.locator('.badge')).toHaveText(badge);
      await expect(p.locator('.badge')).toHaveClass('badge ok');
      await expect(p.getByRole('button')).toHaveText(['usuń']);
      await expect(p.getByText('Trymuję teraz i jest:')).toHaveCount(0);
      await expect(page.locator('#calib tr')).toHaveText(['WariantMnożnik czasuPrace', `Cały worek${mult}1`]);
      await expect(page.locator('#calib p')).toHaveText(
        'Mnożnik > 1 oznacza, że w Twojej pracowni ten wariant schnie wolniej, niż zakłada model.',
      );
      await expect(page.locator('.bar').nth(3)).toContainText('Cały worek ·1');
      const fb = (await stored(page)).pieces[0].fb;
      expect(fb.kind).toBe(kind);
      expect(fb.actualH).toBeCloseTo(50, 9);
      expect(fb.at).toBe(new Date('2026-03-06T11:00:00+01:00').getTime());
      const adj = kind === 'wet' ? 1.2 : kind === 'dry' ? 0.8 : 1;
      expect(fb.sample).toBeCloseTo((50 * adj) / 48.988012103100424, 6);
    });
  }

  test('calibration feeds back into the recommendation', async ({ page }) => {
    await openApp(page);
    await saveBtn(page).click();
    await at(page, '2026-03-06T11:00:00+01:00');
    await page.getByRole('button', { name: 'w sam raz' }).click();
    // same inputs as before rating; only the "Cały worek" multiplier (×1,01) changed
    expect(await snapshot(page)).toEqual({
      kind: 'Rekomendacja',
      big: 'Zostaw odkrytą na 4 h (do śr 4.03 12:44), potem zawiń całą w worek.',
      sub: 'Gotowa ok. pt 6.03 10:17: cel to utrata ok. 6,0% masy (30 g).',
      win: 'Okno: czw 5.03 12:19 → sob 7.03 19:15',
      bars: [
        'Odkryta 6 h',
        'Worek częściowo 1 d',
        'Mokra przechowalnia tylko gdy ma być bardzo mokra lub przy czekaniu 4+ dni 3 d 15 h',
        'Cały worek ·1 5 d 12 h',
        'Pudełko 7 d 15 h+',
      ],
      tracks: [
        '3.125% | target 26.7273%',
        '13.1762% | target 26.7273%',
        '47.5961% | target 26.7273%',
        '71.9171% | target 26.7273%',
        '100% | target 26.7273%',
      ],
      legend: 'Pionowa kreska to Twój termin (2 d 1 h). Liczba przy nazwie to liczba prac, które skalibrowały ten wariant.',
      alts: [
        'Zostaw odkrytą na 4 h (do śr 4.03 13:15), potem włóż do zamkniętego pudełka.',
        'Przykryj luźno workiem (dno lub brzeg odsłonięte) na 19 h (do czw 5.03 03:30), potem zawiń całą w worek.',
        'Przykryj luźno workiem (dno lub brzeg odsłonięte) na 20 h (do czw 5.03 05:14), potem włóż do zamkniętego pudełka.',
      ],
      tips: [],
      save: true,
    });
  });

  test('several rated pieces: geometric mean shrunk towards 1, one row per wrap', async ({ page }) => {
    await openApp(page);
    await saveBtn(page).click(); // full-dominant, predicted ~49 h
    await at(page, '2026-03-04T09:00:01+01:00');
    await page.getByRole('button', { name: 'jutro' }).click();
    await saveBtn(page).click(); // partial single wrap
    await at(page, '2026-03-05T09:00:00+01:00');
    // rate the newest (partial) piece first
    await pieces(page).nth(0).getByRole('button', { name: 'za sucha' }).click();
    await at(page, '2026-03-06T11:00:00+01:00');
    await pieces(page).nth(1).getByRole('button', { name: 'w sam raz' }).click();
    const rows = await page.locator('#calib tr').allInnerTexts();
    expect(rows.map((r) => r.replace(/\s+/g, ' ').trim())).toEqual([
      'Wariant Mnożnik czasu Prace',
      expect.stringMatching(/^Worek częściowo × \d,\d\d 1$/),
      'Cały worek × 1,01 1',
    ]);
    await expect(page.locator('.bar').nth(1)).toContainText('Worek częściowo ·1');
  });

  test('deleting a piece removes it and its calibration', async ({ page }) => {
    await openApp(page);
    await saveBtn(page).click();
    await at(page, '2026-03-06T11:00:00+01:00');
    await page.getByRole('button', { name: 'w sam raz' }).click();
    await expect(page.locator('#calib table')).toHaveCount(1);
    await page.getByRole('button', { name: 'usuń' }).click();
    await expect(page.locator('#pieces')).toHaveText(EMPTY);
    await expect(page.locator('#calib')).toBeEmpty();
    await expect(page.locator('.bar').nth(3)).not.toContainText('·');
    expect(await stored(page)).toEqual({ pieces: [] });
  });

  test('a piece can be saved from the "too fast" warning (plan without a window)', async ({ page }) => {
    await openApp(page);
    await setDateTime(page, 'Chcę trymować', '2026-03-04T11:00');
    await expect(page.locator('.rec .k')).toHaveText('Uwaga');
    await saveBtn(page).click();
    await expect(pieces(page).locator('.meta')).toHaveText('Zostaw odkrytą od razu.Toczona śr 4.03 09:00 · prognoza śr 4.03 14:43');
    const s = (await stored(page)).pieces[0];
    expect(s.plan).toEqual([{ w: 'open', h: null }]);
    expect(s.dom).toBe('open');
    expect(s.ws).toBeNull(); // NaN serialises to null
    expect(s.we).toBeNull();
  });

  test('a piece can be saved from the "too slow" warning (box plan)', async ({ page }) => {
    await openApp(page);
    await setDateTime(page, 'Chcę trymować', '2026-03-24T10:00');
    await saveBtn(page).click();
    await expect(pieces(page).locator('.meta')).toContainText('Włóż do zamkniętego pudełka od razu.');
    expect((await stored(page)).pieces[0].dom).toBe('box');
  });

  test('piece names are HTML-escaped', async ({ page }) => {
    await openApp(page);
    await fill(page, 'Nazwa (opcjonalnie)', '<img src=x onerror=alert(1)> & "x"');
    await saveBtn(page).click();
    await expect(pieces(page).locator('b')).toHaveText('<img src=x onerror=alert(1)> & "x"');
    await expect(page.locator('#pieces img')).toHaveCount(0);
  });

  test('saving scrolls the list into view', async ({ page }) => {
    await page.setViewportSize({ width: 1280, height: 600 });
    await openApp(page);
    await saveBtn(page).click();
    await expect(page.locator('#pieces')).toBeInViewport();
  });
});

test.describe('storage robustness', () => {
  test('corrupted JSON is ignored', async ({ page }) => {
    await openApp(page, { storage: '{not json' });
    await expect(page.locator('#pieces')).toHaveText(EMPTY);
  });

  test('"null" and non-array pieces are tolerated', async ({ page }) => {
    await openApp(page, { storage: 'null' });
    await expect(page.locator('#pieces')).toHaveText(EMPTY);
    await page.evaluate((k) => localStorage.setItem(k, '{"pieces":42}'), STORAGE_KEY);
    await page.reload();
    await expect(page.locator('#pieces')).toHaveText(EMPTY);
    await expect(page.locator('#result .bar')).toHaveCount(5);
  });

  test('pre-existing data from the prototype format is rendered', async ({ page }) => {
    const start = new Date('2026-03-01T12:00:00+01:00').getTime();
    const data = {
      pieces: [
        {
          id: 'abc',
          name: 'miski',
          start,
          mass: 800,
          lossPct: 6,
          plan: [{ w: 'box', h: null }],
          label: 'Włóż do zamkniętego pudełka od razu.',
          dom: 'box',
          predH: 100,
          calUsed: 1,
          ws: 90,
          we: 120,
          fb: { kind: 'wet', actualH: 80, sample: 0.96, at: start + 80 * 3.6e6 },
        },
        {
          id: 'def',
          name: 'talerze',
          start,
          mass: 900,
          lossPct: 6,
          plan: [{ w: 'box', h: null }],
          label: 'Włóż do zamkniętego pudełka od razu.',
          dom: 'box',
          predH: 200,
          calUsed: 1,
          ws: 190,
          we: 220,
          fb: null,
        },
      ],
    };
    await openApp(page, { storage: JSON.stringify(data) });
    await expect(pieces(page).locator('b')).toHaveText(['miski', 'talerze']);
    await expect(pieces(page).locator('.badge')).toHaveText(['była za mokra · po 3 d 8 h', 'za 5 d 11 h']);
    await expect(pieces(page).nth(1).locator('.meta')).toHaveText(
      'Włóż do zamkniętego pudełka od razu.Toczona nd 1.03 12:00 · prognoza pn 9.03 20:00',
    );
    // 0.96 ^ (1/3) = 0.9865 -> "0,99"
    await expect(page.locator('#calib tr').nth(1)).toHaveText('Pudełko× 0,991');
    await expect(page.locator('.bar').nth(4)).toContainText('Pudełko ·1');
  });

  test('feedback samples that are not positive are ignored by calibration', async ({ page }) => {
    const start = new Date('2026-03-01T12:00:00+01:00').getTime();
    const base = {
      start,
      mass: 500,
      lossPct: 6,
      plan: [{ w: 'open', h: null }],
      label: 'x',
      dom: 'open',
      predH: 5,
      calUsed: 1,
      ws: 1,
      we: 2,
    };
    const data = {
      pieces: [
        { ...base, id: 'a', name: 'a', fb: { kind: 'ok', actualH: 5, sample: 0, at: start } },
        { ...base, id: 'b', name: 'b', fb: { kind: 'ok', actualH: 5, sample: -1, at: start } },
      ],
    };
    await openApp(page, { storage: JSON.stringify(data) });
    await expect(page.locator('#calib')).toBeEmpty();
    await expect(page.locator('.bar').first()).not.toContainText('·');
  });
});
