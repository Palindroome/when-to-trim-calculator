import { expect, test, type Locator, type Page } from '@playwright/test';
import { PROTOTYPE, choose, field, fill, openApp, setNight, snapshot, type Field } from './helpers';

test.describe('page shell', () => {
  test('title, language and headings', async ({ page }) => {
    await openApp(page);
    await expect(page).toHaveTitle('Kiedy trymować? – prototyp');
    await expect(page.locator('html')).toHaveAttribute('lang', 'pl');
    await expect(page.getByRole('heading', { level: 1 })).toHaveText('Kiedy trymować?');
    await expect(page.locator('.lead')).toHaveText(
      'Podaj pracę, warunki i termin trymowania. Kalkulator podpowie, jak ją opatulić, i z każdą zapisaną pracą uczy się Twojej pracowni.',
    );
    const h2 = page.getByRole('heading', { level: 2 });
    await expect(h2).toHaveText([
      '1Praca',
      '2Warunki',
      '3Termin',
      'Ile to potrwa w każdym wariancie',
      '4Sprawdź wagą',
      '5Moje prace i kalibracja',
    ]);
  });

  test('unit suffixes next to numeric inputs', async ({ page }) => {
    await openApp(page);
    await expect(page.locator('.unit span')).toHaveText(['g', 'mm', 'mm', '°C', '%', '°C', '%', '°C', '%', 'g']);
  });

  test('explainer is collapsed and expands on click', async ({ page }) => {
    await openApp(page);
    const summary = page.getByText('Jak to liczy (i czego jeszcze nie umie)');
    const body = page.getByText(/^Parowanie zależy od tego/);
    await expect(body).toBeHidden();
    await summary.click();
    await expect(body).toBeVisible();
    await expect(page.locator('details li')).toHaveCount(6);
    await expect(page.locator('details li').nth(1)).toContainText('cały worek ≈ 7%, szczelne pudełko ≈ 5%');
    await expect(page.locator('details li').nth(5)).toContainText('czujniki BLE');
  });
});

test.describe('inputs and defaults', () => {
  test('every field starts with the documented default', async ({ page }) => {
    await openApp(page);
    await expect(field(page, 'Nazwa (opcjonalnie)')).toHaveValue('');
    await expect(field(page, 'Nazwa (opcjonalnie)')).toHaveAttribute('placeholder', 'np. kubki z czwartku');
    await expect(field(page, 'Masa po toczeniu')).toHaveValue('500');
    await expect(field(page, 'Kształt')).toHaveValue('cyl');
    await expect(field(page, 'Grubość ścianki')).toHaveValue('6');
    await expect(field(page, 'Grubość dna')).toHaveValue('9');
    await expect(field(page, 'Masa ceramiczna')).toHaveValue('stone');
    await expect(field(page, 'Podłoże')).toHaveValue('wood');
    await expect(field(page, 'Mokrość po toczeniu')).toHaveValue('normal');
    await expect(field(page, 'Na co ma być gotowa')).toHaveValue('trim');
    await expect(field(page, 'Temperatura w pracowni')).toHaveValue('20');
    await expect(field(page, 'Wilgotność powietrza')).toHaveValue('50');
    await expect(field(page, 'Ruch powietrza przy półce')).toHaveValue('light');
    await expect(page.getByLabel('W nocy jest chłodniej (np. ogrzewanie wyłączone)')).not.toBeChecked();
    await expect(field(page, 'Temperatura nocą (22–7)')).toHaveValue('15');
    await expect(field(page, 'Wilgotność nocą')).toHaveValue('60');
    await expect(field(page, 'Mokra przechowalnia: temp.')).toHaveValue('15');
    await expect(field(page, 'Mokra przechowalnia: wilg.')).toHaveValue('88');
    // thrown = now (seconds dropped), trim = thrown + 2 days at 10:00
    await expect(field(page, 'Wytoczona')).toHaveValue('2026-03-04T09:00');
    await expect(field(page, 'Chcę trymować')).toHaveValue('2026-03-06T10:00');
    await expect(field(page, 'Masa teraz')).toHaveValue('');
    await expect(field(page, 'Masa teraz')).toHaveAttribute('placeholder', 'np. 470');
    await expect(field(page, 'Przez ten czas była')).toHaveValue('open');
  });

  test('seconds of the current time are dropped from the thrown date', async ({ page }) => {
    await openApp(page, { now: '2026-03-04T09:17:42+01:00' });
    await expect(field(page, 'Wytoczona')).toHaveValue('2026-03-04T09:17');
    await expect(field(page, 'Chcę trymować')).toHaveValue('2026-03-06T10:00');
  });

  test('numeric fields are text inputs with a decimal keypad', async ({ page }) => {
    test.skip(PROTOTYPE, 'the prototype uses type=number, see #2');
    await openApp(page);
    // type=text so a typed decimal comma reaches the parser; limits are clamped in code, not by min/max
    for (const l of [
      'Masa po toczeniu',
      'Grubość ścianki',
      'Grubość dna',
      'Temperatura w pracowni',
      'Wilgotność powietrza',
      'Temperatura nocą (22–7)',
      'Wilgotność nocą',
      'Mokra przechowalnia: temp.',
      'Mokra przechowalnia: wilg.',
      'Masa teraz',
    ] as const) {
      await expect(field(page, l)).toHaveAttribute('type', 'text');
      await expect(field(page, l)).toHaveAttribute('inputmode', 'decimal');
      await expect(field(page, l)).toHaveAttribute('autocomplete', 'off');
    }
    await expect(field(page, 'Wytoczona')).toHaveAttribute('type', 'datetime-local');
  });

  const options: Record<string, [string, string][]> = {
    Kształt: [
      ['cyl', 'Kubek / cylinder'],
      ['bowl', 'Miska'],
      ['plate', 'Talerz / płaska'],
      ['vase', 'Wąski wazon'],
      ['closed', 'Forma zamknięta'],
    ],
    'Masa ceramiczna': [
      ['grog', 'Z szamotem'],
      ['stone', 'Kamionka gładka'],
      ['porc', 'Porcelana'],
      ['earth', 'Czerwona / fajans'],
    ],
    Podłoże: [
      ['plastic', 'Bat plastikowy'],
      ['wood', 'Deska / sklejka'],
      ['plaster', 'Bat gipsowy'],
    ],
    'Mokrość po toczeniu': [
      ['dry', 'Toczona „na sucho”'],
      ['normal', 'Normalnie'],
      ['wet', 'Bardzo mokra, dużo szlikru'],
    ],
    'Na co ma być gotowa': [
      ['soft', 'Doklejanie uch / miękka'],
      ['trim', 'Trymowanie'],
      ['hard', 'Rzeźbienie / twarda'],
    ],
    'Ruch powietrza przy półce': [
      ['still', 'Cisza, zamknięty kąt'],
      ['light', 'Lekki ruch (ludzie, wentylacja)'],
      ['draft', 'Przeciąg, wentylator, kaloryfer obok'],
    ],
    'Przez ten czas była': [
      ['open', 'Odkryta'],
      ['partial', 'Worek częściowo'],
      ['damp', 'Mokra przechowalnia'],
      ['full', 'Cały worek'],
      ['box', 'Pudełko'],
    ],
  };
  for (const [label, opts] of Object.entries(options)) {
    test(`select "${label}" offers the expected options`, async ({ page }) => {
      await openApp(page);
      const sel = field(page, label as Parameters<typeof field>[1]);
      const actual = await sel.locator('option').evaluateAll((os) =>
        os.map((o) => [(o as HTMLOptionElement).value, (o.textContent ?? '').trim()]),
      );
      expect(actual).toEqual(opts);
    });
  }
});

test.describe('decimal comma', () => {
  test.skip(PROTOTYPE, 'the prototype drops the decimal comma, see #2');
  // Typed key by key, as a user would: some browsers silently drop the comma in type=number inputs.
  const cases: { label: Field; comma: string; dot: string; setup?: (page: Page) => Promise<void> }[] = [
    { label: 'Masa po toczeniu', comma: '500,5', dot: '500.5' },
    { label: 'Grubość ścianki', comma: '6,5', dot: '6.5' },
    { label: 'Grubość dna', comma: '9,5', dot: '9.5' },
    { label: 'Temperatura w pracowni', comma: '20,5', dot: '20.5' },
    { label: 'Temperatura w pracowni', comma: '-2,5', dot: '-2.5' },
    { label: 'Wilgotność powietrza', comma: '50,5', dot: '50.5' },
    { label: 'Temperatura nocą (22–7)', comma: '12,5', dot: '12.5', setup: (p) => setNight(p, true) },
    { label: 'Wilgotność nocą', comma: '60,5', dot: '60.5', setup: (p) => setNight(p, true) },
    { label: 'Mokra przechowalnia: temp.', comma: '14,5', dot: '14.5', setup: (p) => fill(p, 'Chcę trymować', '2026-03-09T10:00') },
    { label: 'Mokra przechowalnia: wilg.', comma: '88,5', dot: '88.5', setup: (p) => fill(p, 'Chcę trymować', '2026-03-09T10:00') },
    { label: 'Masa teraz', comma: '470,5', dot: '470.5' },
  ];
  for (const { label, comma, dot, setup } of cases) {
    test(`"${comma}" typed into "${label}" gives the same result as "${dot}"`, async ({ page }) => {
      const result = async (): Promise<unknown> => [await snapshot(page), await page.locator('#wout').innerText()];
      await openApp(page);
      await setup?.(page);
      const input = field(page, label);
      await input.fill('');
      await input.pressSequentially(comma);
      await expect(input).toHaveValue(comma);
      const withComma = await result();
      await fill(page, label, dot);
      const withDot = await result();
      expect(withComma).toEqual(withDot);
      // guard: the field matters here, so a dropped comma would have been caught
      await fill(page, label, comma.replace(',', ''));
      expect(await result()).not.toEqual(withDot);
    });
  }
});

test.describe('night mode', () => {
  test('night fields are shown only when the checkbox is ticked', async ({ page }) => {
    await openApp(page);
    const nT = field(page, 'Temperatura nocą (22–7)');
    const nRH = field(page, 'Wilgotność nocą');
    await expect(nT).toBeHidden();
    await expect(nRH).toBeHidden();
    await setNight(page, true);
    await expect(nT).toBeVisible();
    await expect(nRH).toBeVisible();
    await setNight(page, false);
    await expect(nT).toBeHidden();
  });

  test('clicking the label text toggles the checkbox', async ({ page }) => {
    await openApp(page);
    await page.getByText('W nocy jest chłodniej').click();
    await expect(page.getByLabel('W nocy jest chłodniej (np. ogrzewanie wyłączone)')).toBeChecked();
    await expect(field(page, 'Wilgotność nocą')).toBeVisible();
  });
});

test.describe('date chips', () => {
  const chips = (page: Page): Locator => page.locator('#quick').getByRole('button');

  test('chip labels and default highlight', async ({ page }) => {
    await openApp(page);
    await expect(chips(page)).toHaveText(['jutro', 'za 2 dni', 'za 3 dni', 'za 5 dni', 'za tydzień']);
    await expect(page.locator('#quick .chip.on')).toHaveText(['za 2 dni']);
  });

  const cases: [string, string, string][] = [
    ['jutro', '2026-03-05T10:00', '1 d 1 h'],
    ['za 2 dni', '2026-03-06T10:00', '2 d 1 h'],
    ['za 3 dni', '2026-03-07T10:00', '3 d 1 h'],
    ['za 5 dni', '2026-03-09T10:00', '5 d 1 h'],
    ['za tydzień', '2026-03-11T10:00', '7 d 1 h'],
  ];
  for (const [chip, expected, legend] of cases) {
    test(`chip "${chip}" sets the trim date to ${expected} and recalculates`, async ({ page }) => {
      await openApp(page);
      await chips(page).getByText(chip, { exact: true }).click();
      await expect(field(page, 'Chcę trymować')).toHaveValue(expected);
      await expect(page.locator('#quick .chip.on')).toHaveText([chip]);
      await expect(page.locator('.legend')).toContainText(`Twój termin (${legend})`);
    });
  }

  test('chips count from the thrown date, not from today', async ({ page }) => {
    await openApp(page);
    await fill(page, 'Wytoczona', '2026-02-27T22:15');
    // changing the thrown date alone does not move the trim date
    await expect(field(page, 'Chcę trymować')).toHaveValue('2026-03-06T10:00');
    await chips(page).getByText('za 3 dni', { exact: true }).click();
    await expect(field(page, 'Chcę trymować')).toHaveValue('2026-03-02T10:00');
  });

  test('chip with an empty thrown date counts from now', async ({ page }) => {
    await openApp(page);
    await fill(page, 'Wytoczona', '');
    await chips(page).getByText('jutro', { exact: true }).click();
    await expect(field(page, 'Chcę trymować')).toHaveValue('2026-03-05T10:00');
    // calculation also falls back to "now" as the start
    await expect(page.locator('.legend')).toContainText('Twój termin (1 d 1 h)');
  });

  test('editing the trim date by hand clears the highlighted chip', async ({ page }) => {
    await openApp(page);
    await fill(page, 'Chcę trymować', '2026-03-06T18:00');
    await expect(page.locator('#quick .chip.on')).toHaveCount(0);
    await expect(page.locator('.legend')).toContainText('Twój termin (2 d 9 h)');
  });

  test('editing other fields keeps the highlighted chip', async ({ page }) => {
    await openApp(page);
    await fill(page, 'Masa po toczeniu', '800');
    await expect(page.locator('#quick .chip.on')).toHaveText(['za 2 dni']);
  });

  test('empty trim date shows the ordering error', async ({ page }) => {
    await openApp(page);
    await fill(page, 'Chcę trymować', '');
    const s = await snapshot(page);
    expect(s.big).toBe('Termin trymowania musi być po toczeniu.');
    expect(s.legend).toContain('Twój termin (–)');
    expect(s.save).toBe(false);
  });
});

test.describe('live recalculation', () => {
  test('every input change re-renders the result', async ({ page }) => {
    await openApp(page);
    const before = await snapshot(page);
    await choose(page, 'Kształt', 'closed');
    const after = await snapshot(page);
    expect(after.big).not.toBe(before.big);
    await choose(page, 'Kształt', 'cyl');
    expect(await snapshot(page)).toEqual(before);
  });

  test('the name field does not change the result', async ({ page }) => {
    await openApp(page);
    const before = await snapshot(page);
    await fill(page, 'Nazwa (opcjonalnie)', 'miski');
    expect(await snapshot(page)).toEqual(before);
  });

  test('night conditions only matter once night mode is on', async ({ page }) => {
    await openApp(page);
    const before = await snapshot(page);
    await setNight(page, true);
    expect((await snapshot(page)).bars).not.toEqual(before.bars);
  });

  test('result card shows a recommendation label and save button for a normal case', async ({ page }) => {
    await openApp(page);
    await expect(page.locator('#result .rec .k')).toHaveText('Rekomendacja');
    await expect(page.getByRole('button', { name: 'Zapisz tę pracę z planem' })).toBeVisible();
  });

  test('error card is labelled "Uwaga"', async ({ page }) => {
    await openApp(page);
    await fill(page, 'Chcę trymować', '2026-03-01T10:00');
    await expect(page.locator('#result .rec .k')).toHaveText('Uwaga');
    await expect(page.getByRole('button', { name: 'Zapisz tę pracę z planem' })).toHaveCount(0);
  });

  test('alternatives are introduced by a caption', async ({ page }) => {
    await openApp(page);
    await expect(page.getByText('Inne sposoby na ten sam termin:')).toBeVisible();
    await fill(page, 'Chcę trymować', '2026-03-04T11:00');
    await expect(page.getByText('Inne sposoby na ten sam termin:')).toHaveCount(0);
  });
});
