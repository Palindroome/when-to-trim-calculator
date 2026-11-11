import { expect, test, type Page } from '@playwright/test';
import { STORAGE_KEY, openApp, setDateTime, snapshot } from './helpers';

const LABELS = ['Odkryta', 'Worek częściowo', 'Mokra przechowalnia', 'Cały worek', 'Pudełko'];
const DEFAULT_PLAN = 'Zostaw odkrytą na 4 h (do śr 4.03 12:30), potem zawiń całą w worek.';
const NO_OPEN_PLAN = 'Przykryj luźno workiem (dno lub brzeg odsłonięte) na 19 h (do czw 5.03 03:30), potem zawiń całą w worek.';

const group = (page: Page) => page.getByRole('group', { name: 'Sposoby okrycia, których mogę użyć' });
const box = (page: Page, label: string) => group(page).getByRole('checkbox', { name: label, exact: true });
const lastOne = (page: Page) => page.getByText('Zostaw zaznaczony co najmniej jeden sposób.');
const saveBtn = (page: Page) => page.getByRole('button', { name: 'Zapisz tę pracę z planem' });
const stored = (page: Page) => page.evaluate((k) => localStorage.getItem(k), STORAGE_KEY);

async function only(page: Page, keep: string): Promise<void> {
  for (const l of LABELS) if (l !== keep) await box(page, l).uncheck();
}

test.describe('covering methods filter', () => {
  test('all covers are offered and ticked by default; the result is unchanged', async ({ page }) => {
    await openApp(page);
    await expect(group(page).getByRole('checkbox')).toHaveCount(5);
    for (const [i, l] of LABELS.entries()) {
      await expect(group(page).getByRole('checkbox').nth(i)).toHaveAccessibleName(l);
      await expect(box(page, l)).toBeChecked();
      await expect(box(page, l)).toBeEnabled();
    }
    await expect(lastOne(page)).toBeHidden();
    await expect(page.locator('#result .bar.off')).toHaveCount(0);
    await expect(page.locator('.rec .big')).toHaveText(DEFAULT_PLAN);
  });

  test('an unticked cover is never recommended, and its bar is muted', async ({ page }) => {
    await openApp(page);
    await box(page, 'Odkryta').uncheck();
    const s = await snapshot(page);
    expect(s.kind).toBe('Rekomendacja');
    expect(s.big).toBe(NO_OPEN_PLAN);
    for (const t of [s.big, ...s.alts]) expect(t.toLowerCase()).not.toContain('odkryt');
    const bar = page.locator('#result .bar').first();
    await expect(bar).toHaveClass(/\boff\b/);
    await expect(bar).toContainText('Odkryta · wyłączone');
    await expect(bar.locator('.fill.good')).toHaveCount(0);
    await expect(page.locator('#result .bar.off')).toHaveCount(1);
    // the weight check still lists every cover
    await expect(page.getByLabel('Przez ten czas była', { exact: true }).locator('option')).toHaveCount(5);
    // ticking it again restores the default plan
    await box(page, 'Odkryta').check();
    await expect(page.locator('.rec .big')).toHaveText(DEFAULT_PLAN);
    await expect(page.locator('#result .bar.off')).toHaveCount(0);
  });

  test('an excluded cover on target is not highlighted', async ({ page }) => {
    await openApp(page);
    await page.getByRole('button', { name: 'jutro' }).click();
    const bar = page.locator('#result .bar').nth(1);
    await expect(bar.locator('.fill.good')).toHaveCount(1);
    await box(page, 'Worek częściowo').uncheck();
    await expect(bar.locator('.fill.good')).toHaveCount(0);
    await expect(page.locator('.rec .big')).not.toContainText('luźno');
  });

  test('the last ticked cover cannot be unticked', async ({ page }) => {
    await openApp(page);
    await only(page, 'Cały worek');
    await expect(box(page, 'Cały worek')).toBeChecked();
    await expect(box(page, 'Cały worek')).toBeDisabled();
    await expect(lastOne(page)).toBeVisible();
    await box(page, 'Pudełko').check();
    await expect(box(page, 'Cały worek')).toBeEnabled();
    await expect(lastOne(page)).toBeHidden();
  });

  test('too fast without "Odkryta": falls back to the loose bag and names it', async ({ page }) => {
    await openApp(page);
    await setDateTime(page, 'Chcę trymować', '2026-03-04T11:00');
    await box(page, 'Odkryta').uncheck();
    await expect(page.locator('.rec .k')).toHaveText('Uwaga');
    await expect(page.locator('.rec .big')).toHaveText(
      /^Nawet przy najszybszym dostępnym sposobie \(Worek częściowo\) będzie gotowa najwcześniej za .+\. Postaw ją w cieplejszym miejscu z ruchem powietrza, przesuń termin albo włącz inne sposoby okrycia\.$/,
    );
    // even uncovered it would be too slow: no "would make it" hint
    await expect(page.locator('.rec .extra')).toHaveCount(0);
  });

  test('too slow without the box and the full bag: names the slowest allowed cover', async ({ page }) => {
    await openApp(page);
    await setDateTime(page, 'Chcę trymować', '2026-03-24T10:00');
    await box(page, 'Pudełko').uncheck();
    await box(page, 'Cały worek').uncheck();
    await expect(page.locator('.rec .big')).toHaveText(
      /^Nawet przy najwolniejszym dostępnym sposobie \((Mokra przechowalnia|Worek częściowo)\) zajmie to .+ lub mniej\. Sprawdzaj wcześniej albo włącz inne sposoby okrycia\.$/,
    );
  });

  test('says when an excluded cover would make the deadline', async ({ page }) => {
    await openApp(page);
    await only(page, 'Pudełko');
    await expect(page.locator('.rec .k')).toHaveText('Uwaga');
    await expect(page.locator('.rec .extra')).toHaveText('Z wyłączonymi sposobami okrycia zdążyłaby na ten termin.');
  });

  test('the saved piece keeps the plan computed with the exclusions; a reload starts with every cover ticked', async ({ page }) => {
    await openApp(page);
    await box(page, 'Odkryta').uncheck();
    await saveBtn(page).click();
    await expect(page.locator('#pieces .piece .meta')).toContainText(NO_OPEN_PLAN);
    const data = JSON.parse((await stored(page)) ?? 'null');
    const p = data.pieces[0];
    expect(p.label).toBe(NO_OPEN_PLAN);
    expect(p.plan.map((s: { w: string }) => s.w)).not.toContain('open');
    // the stored record format is unchanged: no extra fields
    expect(Object.keys(p).sort()).toEqual(
      ['id', 'name', 'start', 'mass', 'lossPct', 'plan', 'label', 'dom', 'predH', 'calUsed', 'ws', 'we', 'fb'].sort(),
    );
    // nothing about the filter is stored anywhere
    expect(await page.evaluate(() => Object.keys(localStorage).sort())).toEqual([
      'kiedy-trymowac-last-active',
      'kiedy-trymowac-v1',
      'kiedy-trymowac-wizard',
    ]);

    const before = await stored(page);
    await page.reload();
    for (const l of LABELS) await expect(box(page, l)).toBeChecked();
    await expect(page.locator('.rec .big')).toHaveText(DEFAULT_PLAN);
    // the saved prognosis stays as it was shown
    await expect(page.locator('#pieces .piece .meta')).toContainText(NO_OPEN_PLAN);
    expect(await stored(page)).toBe(before);
  });

  test('a language switch keeps the selection', async ({ page }) => {
    await openApp(page);
    await box(page, 'Odkryta').uncheck();
    await page.locator('[data-lang="en"]').click();
    const en = page.getByRole('group', { name: 'Covering methods I can use' });
    await expect(en.getByRole('checkbox', { name: 'Uncovered', exact: true })).not.toBeChecked();
    await expect(en.getByRole('checkbox', { name: 'Loosely bagged', exact: true })).toBeChecked();
    await expect(page.locator('#result .bar.off')).toContainText('Uncovered · excluded');
    await page.locator('[data-lang="pl"]').click();
    await expect(box(page, 'Odkryta')).not.toBeChecked();
    await expect(page.locator('.rec .big')).toHaveText(NO_OPEN_PLAN);
  });

  test('checkboxes work from the keyboard', async ({ page }) => {
    await openApp(page);
    await box(page, 'Odkryta').focus();
    await page.keyboard.press('Space');
    await expect(box(page, 'Odkryta')).not.toBeChecked();
    await expect(page.locator('.rec .big')).toHaveText(NO_OPEN_PLAN);
    await page.keyboard.press('Tab');
    await expect(box(page, 'Worek częściowo')).toBeFocused();
    // the focus ring is drawn on the visible pill
    const ring = await page
      .locator('.pill .face')
      .nth(1)
      .evaluate((el) => parseFloat(getComputedStyle(el).outlineWidth));
    expect(ring).toBeGreaterThanOrEqual(2);
  });

  test('pills show a check when ticked and a cross when not', async ({ page }) => {
    await openApp(page);
    await box(page, 'Odkryta').uncheck();
    const pill = (i: number) => page.locator('.pill .face').nth(i);
    await expect(pill(0).locator('.ico.off')).toBeVisible();
    await expect(pill(0).locator('.ico.on')).toBeHidden();
    await expect(pill(1).locator('.ico.on')).toBeVisible();
    await expect(pill(1).locator('.ico.off')).toBeHidden();
    const bg = (i: number) => pill(i).evaluate((el) => getComputedStyle(el).backgroundColor);
    expect(await bg(1)).not.toBe(await bg(0));
  });
});

test.describe('covering methods layout', () => {
  /** top edge and right edge of each pill, plus the fieldset's right edge */
  const geometry = (page: Page) =>
    page.locator('#covers').evaluate((fs) => ({
      tops: [...fs.querySelectorAll('.pill')].map((p) => Math.round(p.getBoundingClientRect().top)),
      rights: [...fs.querySelectorAll('.pill')].map((p) => p.getBoundingClientRect().right),
      heights: [...fs.querySelectorAll('.pill')].map((p) => p.getBoundingClientRect().height),
      edge: fs.getBoundingClientRect().right,
    }));

  test('1280 px: all five pills share one row, each 44 px tall', async ({ page }) => {
    await page.setViewportSize({ width: 1280, height: 900 });
    await openApp(page);
    const g = await geometry(page);
    expect(g.tops).toHaveLength(5);
    expect(new Set(g.tops).size).toBe(1);
    for (const h of g.heights) expect(h).toBeGreaterThanOrEqual(44);
  });

  test('320 px: pills wrap without overflowing', async ({ page }) => {
    await page.setViewportSize({ width: 320, height: 900 });
    await openApp(page);
    const g = await geometry(page);
    for (const r of g.rights) expect(r).toBeLessThanOrEqual(g.edge + 0.5);
    const { scrollWidth, clientWidth } = await page.evaluate(() => ({
      scrollWidth: document.documentElement.scrollWidth,
      clientWidth: document.documentElement.clientWidth,
    }));
    expect(scrollWidth).toBeLessThanOrEqual(clientWidth);
  });
});
