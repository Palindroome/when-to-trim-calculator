import { expect, type Page, test } from '@playwright/test';
import { COVERS_KEY, openApp, STORAGE_KEY } from './helpers';

const LABELS = ['Odkryta', 'Worek częściowo', 'Mokra przechowalnia', 'Cały worek', 'Pudełko'];
const EMPTY = 'Nie masz jeszcze własnych opatuleń.';

const bars = (page: Page) => page.locator('#result .bar');
const bar = (page: Page, name: string) => bars(page).filter({ hasText: name });
const pill = (page: Page, name: string) =>
  page
    .getByRole('group', { name: 'Sposoby okrycia, których mogę użyć' })
    .getByRole('checkbox', { name, exact: true });
const list = (page: Page) => page.locator('#cc-list');
const nameField = (page: Page) => page.getByLabel('Nazwa', { exact: true });
const percentField = (page: Page) => page.getByLabel('Tempo schnięcia względem odkrytej');
const presetField = (page: Page) => page.getByLabel('Jak bardzo spowalnia schnięcie?');
const addBtn = (page: Page) => page.getByRole('button', { name: 'Dodaj opatulenie' });
const saveCoverBtn = (page: Page) => page.getByRole('button', { name: 'Zapisz', exact: true });
const savePieceBtn = (page: Page) => page.getByRole('button', { name: 'Zapisz tę pracę z planem' });
const item = (page: Page, key: string) =>
  page.evaluate((k) => localStorage.getItem(k), key) as Promise<string | null>;
const storedCovers = async (page: Page) => JSON.parse((await item(page, COVERS_KEY)) ?? 'null');
/** The first path of an icon, enough to tell the icons apart. */
const iconPath = (scope: ReturnType<Page['locator']>) =>
  scope.locator('svg path').first().getAttribute('d');
const radioIcon = (page: Page, name: string) =>
  page.locator('.cc-icon').filter({ has: page.getByRole('radio', { name, exact: true }) });

const toggle = (page: Page) => page.getByRole('button', { name: 'Moje opatulenia' });

async function openCovers(page: Page): Promise<void> {
  await toggle(page).click();
  await expect(toggle(page)).toHaveAttribute('aria-expanded', 'true');
}

interface CoverInput {
  preset?: string;
  /** typed into "Własna wartość…" */
  percent?: string;
  airflow?: boolean;
  icon?: string;
}

async function fillCover(page: Page, name: string, c: CoverInput = {}): Promise<void> {
  await nameField(page).fill(name);
  if (c.icon) await page.getByRole('radio', { name: c.icon, exact: true }).check();
  if (c.percent !== undefined) {
    await presetField(page).selectOption({ label: 'Własna wartość…' });
    await percentField(page).fill(c.percent);
    await page.getByLabel('Przepuszcza ruch powietrza').setChecked(c.airflow ?? false);
  } else if (c.preset) {
    await presetField(page).selectOption({ label: c.preset });
  }
  await saveCoverBtn(page).click();
}

async function addCover(page: Page, name: string, c: CoverInput = {}): Promise<void> {
  await addBtn(page).click();
  await fillCover(page, name, c);
}

const cover = (id: string, name: string, factor: number, extra: object = {}) => ({
  id: `custom:${id}`,
  name,
  factor,
  airflow: 'none',
  preset: 'custom',
  icon: 'cover',
  created: 1,
  ...extra,
});

test.describe('custom covers', () => {
  test('a cover added with a preset gets a bar, a pill and a select option, and survives a reload', async ({
    page,
  }) => {
    await openApp(page);
    await openCovers(page);
    await expect(list(page)).toHaveText(EMPTY);
    await addCover(page, '  Torba papierowa ', {
      preset: 'Lekko spowalnia (np. papierowa torba, gazeta)',
    });
    // 60% sorts it right after "Odkryta"
    const order = ['Odkryta', 'Torba papierowa', ...LABELS.slice(1)];
    await expect(bars(page)).toHaveCount(6);
    await expect(bars(page).nth(1)).toContainText('Torba papierowa');
    await expect(page.locator('#wnow option')).toHaveText(order);
    await expect(pill(page, 'Torba papierowa')).toBeChecked();
    await expect(list(page).locator('li')).toHaveText(
      'Torba papierowa≈ 60% tempa odkrytejedytujusuń',
    );
    const [c] = (await storedCovers(page)).covers;
    expect(c).toMatchObject({
      name: 'Torba papierowa',
      factor: 0.6,
      airflow: 'damped',
      preset: 'slight',
      icon: 'cover',
    });
    expect(c.id).toMatch(/^custom:[a-z0-9]+$/);
    expect(await item(page, STORAGE_KEY)).toBeNull();

    await page.reload();
    await expect(bars(page)).toHaveCount(6);
    await expect(page.locator('#wnow option')).toHaveText(order);
    await expect(list(page).locator('li')).toContainText('Torba papierowa');
  });

  test('a custom cover can be recommended, saved, rated and calibrated; names are escaped', async ({
    page,
  }) => {
    const name = '<b>Szmatka</b> & "q"';
    await openApp(page);
    await openCovers(page);
    // 20% without airflow takes about the 49 h of the default deadline
    await addCover(page, name, { percent: '20' });
    await expect(page.locator('.rec .big')).toHaveText(`Użyj opatulenia „${name}” od razu.`);
    await expect(bar(page, name)).toHaveCount(1);
    await expect(page.locator('#wnow option').filter({ hasText: name })).toHaveCount(1);
    await expect(pill(page, name)).toBeChecked();
    await expect(list(page).locator('.cc-name')).toHaveText(name);
    await expect(page.getByRole('button', { name: `usuń: ${name}`, exact: true })).toBeVisible();

    await savePieceBtn(page).click();
    const piece = page.locator('#pieces .piece');
    await expect(piece.locator('.meta')).toContainText(`Użyj opatulenia „${name}” od razu.`);
    const id = (await storedCovers(page)).covers[0].id;
    const saved = JSON.parse((await item(page, STORAGE_KEY))!).pieces[0];
    expect(saved.dom).toBe(id);
    expect(saved.plan).toEqual([{ w: id, h: null }]);

    await page.clock.setFixedTime(new Date('2026-03-06T10:00:00+01:00'));
    await piece.getByRole('button', { name: 'w sam raz' }).click();
    await expect(page.locator('#calib tr').nth(1)).toHaveText(new RegExp(`^${escapeRe(name)}× `));
    await expect(bar(page, name)).toContainText('·1');
    // nothing the user typed became markup
    await expect(page.locator('main b').filter({ hasText: 'Szmatka' })).toHaveCount(0);
  });

  test('editing renames the cover everywhere and keeps its calibration; removing drops it, the piece keeps its sentence', async ({
    page,
  }) => {
    await openApp(page);
    await openCovers(page);
    await addCover(page, 'Szmatka', { percent: '20' });
    await savePieceBtn(page).click();
    await page.clock.setFixedTime(new Date('2026-03-06T10:00:00+01:00'));
    await page.locator('#pieces .piece').getByRole('button', { name: 'w sam raz' }).click();

    await page.getByRole('button', { name: 'edytuj: Szmatka', exact: true }).click();
    await expect(page.locator('#cc-form-title')).toHaveText('Edycja: Szmatka');
    await expect(nameField(page)).toHaveValue('Szmatka');
    await expect(presetField(page)).toHaveValue('custom');
    await expect(percentField(page)).toHaveValue('20');
    await nameField(page).fill('Ściereczka');
    await saveCoverBtn(page).click();
    await expect(page.getByRole('button', { name: 'edytuj: Ściereczka' })).toBeFocused();
    await expect(bar(page, 'Ściereczka')).toContainText('·1');
    await expect(bars(page).filter({ hasText: 'Szmatka' })).toHaveCount(0);
    await expect(page.locator('#wnow option').filter({ hasText: 'Ściereczka' })).toHaveCount(1);
    await expect(pill(page, 'Ściereczka')).toBeVisible();
    await expect(page.locator('#calib tr').nth(1)).toContainText('Ściereczka');
    await expect(page.locator('#pieces .meta')).toContainText(
      'Użyj opatulenia „Ściereczka” od razu.',
    );

    // a saved piece uses it, so removing asks first
    let message = '';
    page.once('dialog', (d) => {
      message = d.message();
      void d.accept();
    });
    await page.getByRole('button', { name: 'usuń: Ściereczka', exact: true }).click();
    expect(message).toContain('„Ściereczka”: 1. Usunąć to opatulenie?');
    await expect(bars(page)).toHaveCount(5);
    await expect(page.locator('#wnow option')).toHaveText(LABELS);
    await expect(pill(page, 'Ściereczka')).toHaveCount(0);
    await expect(list(page)).toHaveText(EMPTY);
    await expect(addBtn(page)).toBeFocused();
    // the stored sentence (with the name at save time); its rating no longer calibrates anything
    await expect(page.locator('#pieces .meta')).toContainText('Użyj opatulenia „Szmatka” od razu.');
    await expect(page.locator('#calib')).toBeEmpty();
    expect(await storedCovers(page)).toEqual({ covers: [] });
  });

  test('a language switch keeps the covers and their names', async ({ page }) => {
    await openApp(page);
    await openCovers(page);
    await addCover(page, 'Szmatka', { percent: '20' });
    await page.locator('[data-lang="en"]').click();
    await expect(page.locator('.rec .big')).toHaveText('Use the cover “Szmatka” straight away.');
    await expect(bar(page, 'Szmatka')).toHaveCount(1);
    await page.getByRole('button', { name: 'My covers' }).click();
    await expect(page.locator('#cc-list li')).toContainText('≈ 20% of the uncovered speed');
    await expect(page.getByRole('button', { name: 'Add a cover' })).toBeVisible();
  });

  test('dismissing the confirmation keeps a cover that saved pieces use', async ({ page }) => {
    await openApp(page);
    await openCovers(page);
    await addCover(page, 'Szmatka', { percent: '20' });
    await savePieceBtn(page).click();
    page.once('dialog', (d) => void d.dismiss());
    await page.getByRole('button', { name: 'usuń: Szmatka', exact: true }).click();
    await expect(bars(page)).toHaveCount(6);
  });

  test('validation: name and percentage', async ({ page }) => {
    await openApp(page);
    await openCovers(page);
    await addBtn(page).click();
    await expect(page.locator('#cc-form-title')).toHaveText('Nowe opatulenie');
    await expect(nameField(page)).toBeFocused();
    await saveCoverBtn(page).click();
    await expect(nameField(page)).toHaveAttribute('aria-invalid', 'true');
    await expect(nameField(page)).toHaveAccessibleDescription('Podaj nazwę.');
    await nameField(page).fill(' odkryta ');
    await saveCoverBtn(page).click();
    await expect(nameField(page)).toHaveAccessibleDescription('Takie opatulenie już jest.');
    await nameField(page).fill('a'.repeat(41));
    await saveCoverBtn(page).click();
    await expect(nameField(page)).toHaveAccessibleDescription(
      'Nazwa może mieć najwyżej 40 znaków.',
    );

    await nameField(page).fill('Gazeta');
    await presetField(page).selectOption({ label: 'Własna wartość…' });
    for (const bad of ['0', '101', 'abc']) {
      await percentField(page).fill(bad);
      await saveCoverBtn(page).click();
      await expect(percentField(page)).toHaveAccessibleDescription('Podaj wartość od 1 do 100%.');
      await expect(percentField(page)).toBeFocused();
      await expect(nameField(page)).not.toHaveAttribute('aria-invalid');
    }
    await expect(bars(page)).toHaveCount(5);
    await percentField(page).fill('12,5');
    await saveCoverBtn(page).click();
    await expect(bars(page)).toHaveCount(6);
    await expect(list(page).locator('li')).toContainText('≈ 12,5% tempa odkrytej');
    expect((await storedCovers(page)).covers[0]).toMatchObject({ factor: 0.125, preset: 'custom' });

    // a second cover cannot take a name in use
    await addCover(page, 'GAZETA');
    await expect(nameField(page)).toHaveAccessibleDescription('Takie opatulenie już jest.');
  });

  test('add, edit and remove from the keyboard', async ({ page }) => {
    await openApp(page);
    await toggle(page).focus();
    await page.keyboard.press('Enter');
    await expect(toggle(page)).toHaveAttribute('aria-expanded', 'true');
    await expect(addBtn(page)).toBeVisible();
    await page.keyboard.press('Tab');
    await expect(addBtn(page)).toBeFocused();
    await page.keyboard.press('Enter');
    await expect(nameField(page)).toBeFocused();
    await page.keyboard.type('Wiadro');
    await page.keyboard.press('Tab');
    await expect(page.getByRole('radio', { name: 'warstwy', exact: true })).toBeFocused();
    await page.keyboard.press('ArrowRight');
    await expect(page.getByRole('radio', { name: 'miska', exact: true })).toBeChecked();
    await page.keyboard.press('Shift+Tab');
    await page.keyboard.press('Enter');
    await expect(bars(page)).toHaveCount(6);
    const edit = page.getByRole('button', { name: 'edytuj: Wiadro', exact: true });
    await expect(edit).toBeFocused();

    await page.keyboard.press('Enter');
    await expect(nameField(page)).toBeFocused();
    await page.keyboard.press('ControlOrMeta+a');
    await page.keyboard.type('Kubeł');
    await page.keyboard.press('Enter');
    await expect(page.getByRole('button', { name: 'edytuj: Kubeł', exact: true })).toBeFocused();
    await expect(bar(page, 'Kubeł')).toHaveCount(1);

    await page.keyboard.press('Tab');
    await expect(page.getByRole('button', { name: 'usuń: Kubeł', exact: true })).toBeFocused();
    await page.keyboard.press('Enter');
    await expect(bars(page)).toHaveCount(5);
    await expect(addBtn(page)).toBeFocused();
  });

  test('the chosen icon is shown in the bars, the pills and the list, and can be changed', async ({
    page,
  }) => {
    await openApp(page);
    await openCovers(page);
    await addBtn(page).click();
    await expect(page.getByRole('radio', { name: 'warstwy', exact: true })).toBeChecked();
    const bucket = await iconPath(radioIcon(page, 'wiadro'));
    const paper = await iconPath(radioIcon(page, 'gazeta'));
    await fillCover(page, 'Wiadro', { icon: 'wiadro', preset: 'Jak szczelne pudełko' });
    const label = page
      .locator('.pill')
      .filter({ has: page.getByRole('checkbox', { name: 'Wiadro', exact: true }) });
    expect(await iconPath(bar(page, 'Wiadro'))).toBe(bucket);
    expect(await iconPath(label)).toBe(bucket);
    expect(await iconPath(list(page).locator('li'))).toBe(bucket);

    await page.getByRole('button', { name: 'edytuj: Wiadro', exact: true }).click();
    await expect(page.getByRole('radio', { name: 'wiadro', exact: true })).toBeChecked();
    await page.getByRole('radio', { name: 'gazeta', exact: true }).check();
    await saveCoverBtn(page).click();
    expect(await iconPath(bar(page, 'Wiadro'))).toBe(paper);
    expect(await iconPath(label)).toBe(paper);
    expect((await storedCovers(page)).covers[0].icon).toBe('newspaper');
  });

  test('removing the only ticked cover ticks every cover again', async ({ page }) => {
    await openApp(page);
    await openCovers(page);
    await addCover(page, 'Torba', { preset: 'Jak worek częściowo' });
    for (const l of LABELS) await pill(page, l).uncheck();
    await expect(pill(page, 'Torba')).toBeDisabled();
    await page.getByRole('button', { name: 'usuń: Torba', exact: true }).click();
    for (const l of LABELS) await expect(pill(page, l)).toBeChecked();
    await expect(page.locator('#result .bar.off')).toHaveCount(0);
  });

  test('a new cover is ticked and an unticked one stays unticked', async ({ page }) => {
    await openApp(page);
    await openCovers(page);
    await pill(page, 'Pudełko').uncheck();
    await addCover(page, 'Torba');
    await expect(pill(page, 'Torba')).toBeChecked();
    await expect(pill(page, 'Pudełko')).not.toBeChecked();
  });

  test('at most 12 covers: the add button is disabled and says why', async ({ page }) => {
    const covers = Array.from({ length: 12 }, (_, i) => cover(`c${i}`, `Okrycie ${i}`, 0.5));
    await openApp(page, { covers: JSON.stringify({ covers }), bars: 17 });
    await openCovers(page);
    await expect(addBtn(page)).toBeDisabled();
    await expect(addBtn(page)).toHaveAccessibleDescription(
      'Masz już 12 własnych opatuleń – więcej nie można dodać.',
    );
    await page.getByRole('button', { name: 'usuń: Okrycie 0', exact: true }).click();
    await expect(addBtn(page)).toBeEnabled();
    await expect(page.locator('#cc-limit')).toBeHidden();
  });

  test('unusable stored entries are skipped; an unknown icon gets the neutral one', async ({
    page,
  }) => {
    const covers = [
      cover('ok', 'Torba', 0.6, { icon: 'nope' }),
      cover('ok', 'Duplikat', 0.6),
      cover('bad', 'Zła', 2),
      { id: 'open', name: 'Udawana', factor: 0.5, airflow: 'none' },
      'x',
      null,
    ];
    await openApp(page, { covers: JSON.stringify({ covers }), bars: 6 });
    await openCovers(page);
    await expect(list(page).locator('li')).toHaveCount(1);
    await addBtn(page).click();
    const neutral = await iconPath(radioIcon(page, 'warstwy'));
    expect(await iconPath(bar(page, 'Torba'))).toBe(neutral);
  });

  test('320 px: a 40-character name and the open form fit without horizontal scrolling', async ({
    page,
  }) => {
    await page.setViewportSize({ width: 320, height: 800 });
    await openApp(page);
    await openCovers(page);
    await addCover(page, 'Torba papierowa z bardzo długą nazwą xx', { percent: '20' });
    await addBtn(page).click();
    await presetField(page).selectOption({ label: 'Własna wartość…' });
    await saveCoverBtn(page).click();
    expect(await page.evaluate(() => document.documentElement.scrollWidth)).toBe(320);
  });

  test('320 px: a 40-character name without spaces wraps in the bars, recommendation, saved piece and calibration', async ({
    page,
  }) => {
    const name = 'W'.repeat(40);
    await page.setViewportSize({ width: 320, height: 800 });
    await openApp(page);
    await openCovers(page);
    await addCover(page, name, { percent: '20' });
    await expect(page.locator('.rec .big')).toHaveText(`Użyj opatulenia „${name}” od razu.`);
    await savePieceBtn(page).click();
    await page.clock.setFixedTime(new Date('2026-03-06T10:00:00+01:00'));
    await page.locator('#pieces .piece').getByRole('button', { name: 'w sam raz' }).click();
    await expect(page.locator('#calib tr').nth(1)).toContainText(name);
    expect(await page.evaluate(() => document.documentElement.scrollWidth)).toBe(320);
  });

  test('a garbage covers key means no custom covers', async ({ page }) => {
    await openApp(page, { covers: '{not json' });
    await openCovers(page);
    await expect(list(page)).toHaveText(EMPTY);
  });
});

test.describe('custom covers and saved pieces (kiedy-trymowac-v1)', () => {
  const start = new Date('2026-03-01T12:00:00+01:00').getTime();
  const V1 = JSON.stringify({
    pieces: [
      {
        id: 'abc',
        name: 'miski',
        start,
        mass: 800,
        lossPct: 6,
        plan: [{ w: 'custom:paper', h: null }],
        label: 'Użyj opatulenia „Torba” od razu.',
        dom: 'custom:paper',
        predH: 100,
        calUsed: 1,
        ws: 90,
        we: 120,
        fb: { kind: 'wet', actualH: 80, sample: 0.96, at: start + 80 * 3.6e6 },
      },
    ],
    extra: 1,
  });

  test('a piece of a cover that no longer exists shows its stored sentence and does not calibrate', async ({
    page,
  }) => {
    await openApp(page, { storage: V1 });
    await expect(page.locator('#pieces .meta')).toContainText('Użyj opatulenia „Torba” od razu.');
    await expect(page.locator('#calib')).toBeEmpty();
  });

  test('with the cover still defined, its calibration row shows its name', async ({ page }) => {
    const covers = { covers: [cover('paper', 'Torba papierowa', 0.6)] };
    await openApp(page, { storage: V1, covers: JSON.stringify(covers), bars: 6 });
    await expect(page.locator('#calib tr').nth(1)).toHaveText('Torba papierowa× 0,991');
    await expect(page.locator('#pieces .meta')).toContainText(
      'Użyj opatulenia „Torba papierowa” od razu.',
    );
  });

  test('adding, editing and removing covers leaves kiedy-trymowac-v1 byte-identical', async ({
    page,
  }) => {
    await openApp(page, { storage: V1 });
    await openCovers(page);
    await addCover(page, 'Gazeta');
    await page.getByRole('button', { name: 'edytuj: Gazeta', exact: true }).click();
    await fillCover(page, 'Gazeta 2', { percent: '40', airflow: true });
    await page.getByRole('button', { name: 'usuń: Gazeta 2', exact: true }).click();
    expect(await item(page, STORAGE_KEY)).toBe(V1);
  });
});

function escapeRe(s: string): string {
  return s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}
