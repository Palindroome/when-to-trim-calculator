import { expect, type Page, test } from '@playwright/test';
import { field, fill, openApp, type Snapshot, setNight, snapshot } from './helpers';

// The rest of the suite runs with reduced motion (playwright.config.ts). Here the animations are on, and every
// test checks that once they have settled the page is exactly what reduced motion shows at once.

const SAVE = 'Zapisz tę pracę z planem';

/** Resolves when the app's own animations (also the counting numbers, which are not WAAPI) and all WAAPI/CSS animations are done. */
async function waitForMotionIdle(page: Page): Promise<void> {
  await page.evaluate(async () => {
    await window.__motionIdle?.();
    await Promise.all(document.getAnimations().map((a) => a.finished.catch(() => undefined)));
  });
}

/** Whether the app's motion helper reports nothing running, checked without waiting. */
const helperIdleNow = (page: Page): Promise<boolean> =>
  page.evaluate(() =>
    Promise.race([
      window.__motionIdle!().then(() => true),
      new Promise<boolean>((r) => setTimeout(() => r(false), 0)),
    ]),
  );

/** The result after `steps`, from a fresh load with reduced motion: what the animated run must settle on. */
async function reducedResult(page: Page, steps: (page: Page) => Promise<void>): Promise<Snapshot> {
  await page.emulateMedia({ reducedMotion: 'reduce' });
  await page.reload();
  await expect(page.locator('#result .bar')).toHaveCount(5);
  await steps(page);
  return snapshot(page);
}

/** Text of every counting number in the result, by key. */
const numbers = (page: Page): Promise<Record<string, string>> =>
  page.evaluate(() =>
    Object.fromEntries(
      [...document.querySelectorAll<HTMLElement>('#result .num')].map((el) => [
        el.dataset.numKey,
        el.textContent,
      ]),
    ),
  );

/** "1 d 3 h", "5 h", "40 min" (optionally with "+") in hours. */
const hours = (text: string): number => {
  const part = (re: RegExp): number => Number(re.exec(text)?.[1] ?? 0);
  return part(/(\d+) d/) * 24 + part(/(\d+) h/) + part(/(\d+) min/) / 60;
};

test.describe('with motion', () => {
  test.use({ reducedMotion: 'no-preference' });

  test.beforeEach(async ({ page }) => {
    await openApp(page);
  });

  test('a changed plan animates, then settles on exactly the reduced-motion result', async ({
    page,
  }) => {
    const steps = async (p: Page): Promise<void> => {
      await p.locator('#quick .chip', { hasText: 'jutro' }).click();
    };
    await steps(page);
    expect(await page.evaluate(() => document.getAnimations().length)).toBeGreaterThan(0);
    await expect(page.locator('#quick .slide-ind')).toHaveCount(1);
    await waitForMotionIdle(page);
    await expect(page.locator('.slide-ind')).toHaveCount(0);
    await expect(page.locator('#quick .chip.on')).toHaveText('jutro');
    const settled = await snapshot(page);
    expect(settled).toEqual(await reducedResult(page, steps));
  });

  test('numbers count with only the final value exposed, and end on the exact text', async ({
    page,
  }) => {
    // the mass changes the grams; the wall the durations and the ready date
    const steps = async (p: Page): Promise<void> => {
      await fill(p, 'Masa po toczeniu', '1500');
      await fill(p, 'Grubość ścianki', '10');
    };
    const before = await numbers(page);
    await steps(page);
    const counting = await page.evaluate(() =>
      [...document.querySelectorAll<HTMLElement>('#result .num[aria-hidden="true"]')].map((el) => ({
        key: el.dataset.numKey!,
        final: el.nextElementSibling?.matches('.vh') ? el.nextElementSibling.textContent : null,
      })),
    );
    expect(counting.map((c) => c.key)).toEqual(expect.arrayContaining(['bar-open', 'ready']));
    await waitForMotionIdle(page);
    const after = await numbers(page);
    for (const c of counting) expect(c.final).toBe(after[c.key]);
    expect(after['bar-open']).not.toBe(before['bar-open']);
    await expect(page.locator('#result .num[aria-hidden]')).toHaveCount(0);
    await expect(page.locator('#result .num + .vh')).toHaveCount(0);
    const tabular = await page
      .locator('#result .num')
      .evaluateAll((els) =>
        els.every((el) => getComputedStyle(el).fontVariantNumeric.includes('tabular-nums')),
      );
    expect(tabular).toBe(true);
    const settled = await snapshot(page);
    expect(settled).toEqual(await reducedResult(page, steps));
  });

  test('fast typing retargets the count from the shown value, never restarting', async ({
    page,
  }) => {
    const walls = ['7', '8', '9', '10', '11'];
    const first = page.locator('#result .bar .t').first();
    const start = (await first.textContent())!;
    await page.evaluate(() => {
      const w = window as unknown as { samples: string[]; sampling: boolean };
      w.samples = [];
      w.sampling = true;
      const tick = (): void => {
        w.samples.push(document.querySelector('#result .bar .t .num')!.textContent!);
        if (w.sampling) requestAnimationFrame(tick);
      };
      requestAnimationFrame(tick);
    });
    for (const w of walls) await fill(page, 'Grubość ścianki', w);
    await waitForMotionIdle(page);
    const samples = await page.evaluate(() => {
      const w = window as unknown as { samples: string[]; sampling: boolean };
      w.sampling = false;
      return w.samples;
    });
    // a thicker wall takes longer at every step, so the shown duration only ever grows towards the latest target
    const values = samples.map(hours);
    for (let i = 1; i < values.length; i++)
      expect(values[i]).toBeGreaterThanOrEqual(values[i - 1]!);
    const left = samples.findIndex((s) => s !== start);
    expect(left).toBeGreaterThan(0);
    expect(samples.slice(left)).not.toContain(start);
    await expect(page.locator('#result .rec .big')).toHaveCount(1);
    expect(await page.evaluate(() => document.getAnimations().length)).toBe(0);
    await expect(page.locator('#result .num + .vh')).toHaveCount(0);
    const final = await first.textContent();
    const reduced = await reducedResult(page, async (p) => fill(p, 'Grubość ścianki', '11'));
    expect(reduced.bars[0]).toContain(final);
  });

  test('focus stays on the edited field while the result animates', async ({ page }) => {
    const mass = field(page, 'Masa po toczeniu');
    await mass.click();
    await mass.press('End');
    await mass.press('0');
    await expect(mass).toBeFocused();
    await waitForMotionIdle(page);
    await expect(mass).toBeFocused();
    await expect(mass).toHaveValue('5000');
  });

  test('a saved piece enters and a removed one leaves', async ({ page }) => {
    await page.getByRole('button', { name: SAVE }).click();
    await expect(page.locator('#pieces .piece')).toHaveCount(1);
    await waitForMotionIdle(page);
    await page.locator('#pieces .del').click();
    await waitForMotionIdle(page);
    await expect(page.locator('#pieces .piece')).toHaveCount(0);
    await expect(page.locator('#pieces .empty')).toBeVisible();
  });

  test('the night fields expand and collapse', async ({ page }) => {
    const nightTemp = field(page, 'Temperatura nocą (22–7)');
    await setNight(page, true);
    await waitForMotionIdle(page);
    await expect(nightTemp).toBeVisible();
    await setNight(page, false);
    await waitForMotionIdle(page);
    await expect(nightTemp).toBeHidden();
  });
});

test.describe('with reduced motion', () => {
  test.beforeEach(async ({ page }) => {
    await openApp(page);
  });

  test('nothing animates and numbers are never hidden', async ({ page }) => {
    await page.locator('#quick .chip', { hasText: 'jutro' }).click();
    expect(await page.evaluate(() => document.getAnimations().length)).toBe(0);
    expect(await helperIdleNow(page)).toBe(true);
    await fill(page, 'Masa po toczeniu', '1500');
    await expect(page.locator('#result .num[aria-hidden]')).toHaveCount(0);
    expect(await helperIdleNow(page)).toBe(true);
    await expect(page.locator('.slide-ind')).toHaveCount(0);
  });

  test('removing a piece removes it at once', async ({ page }) => {
    await page.getByRole('button', { name: SAVE }).click();
    await expect(page.locator('#pieces .piece')).toHaveCount(1);
    await page.locator('#pieces .del').click();
    expect(await page.locator('#pieces .piece').count()).toBe(0);
  });
});

for (const reducedMotion of ['no-preference', 'reduce'] as const) {
  test.describe(`save button (${reducedMotion})`, () => {
    test.use({ reducedMotion });

    test('says "Zapisano" with a check for a moment, announced, then returns', async ({ page }) => {
      await openApp(page);
      await page.getByRole('button', { name: SAVE }).click();
      const button = page.locator('#savebtn');
      await expect(button).toHaveText('Zapisano');
      await expect(button.locator('svg[aria-hidden="true"]')).toHaveCount(1);
      await expect(page.locator('#savestatus')).toHaveText('Zapisano');
      await expect(page.getByRole('button', { name: SAVE })).toBeVisible({ timeout: 5000 });
      await expect(button.locator('svg')).toHaveCount(0);
      await expect(page.locator('#savestatus')).toHaveText('');
    });
  });
}
