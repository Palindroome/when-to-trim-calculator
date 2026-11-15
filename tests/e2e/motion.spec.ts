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

  test('a recommendation line whose wording is unchanged does not fade in again mid-count', async ({
    page,
  }) => {
    await fill(page, 'Masa po toczeniu', '1500');
    // lands while the grams are still counting
    await fill(page, 'Masa po toczeniu', '1600');
    const { fading, counting } = await page.evaluate(() => ({
      fading: document
        .getAnimations()
        .map((a) => (a.effect as KeyframeEffect).target as Element | null)
        .filter((el) => el?.matches('.rec .sub, .rec .win, .rec .big')).length,
      counting: document.querySelectorAll('#result .num[aria-hidden="true"]').length,
    }));
    expect(counting).toBeGreaterThan(0);
    expect(fading).toBe(0);
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

const card = (page: Page, n: number) => page.locator('main > section[data-step]').nth(n - 1);

/** First run through the wizard to the collapsed summary cards, at the desktop size of #61. */
async function openCards(page: Page): Promise<void> {
  await page.setViewportSize({ width: 1280, height: 900 });
  await openApp(page, { wizard: true });
  await page.getByRole('button', { name: 'Dalej' }).click();
  await page.getByRole('button', { name: 'Dalej' }).click();
  await page.getByRole('button', { name: 'Pokaż wynik' }).click();
  await expect(card(page, 1).locator('.toggle')).toHaveText('Zmień');
}

/** What a toggle resizes, as selectors (the first match of each) */
interface Target {
  /** the element that grows and shrinks */
  box: string;
  /** what is clicked */
  toggle: string;
  /** an element below it that moves with it */
  below: string;
}
const CARD_1: Target = {
  box: 'main > section[data-step]',
  toggle: 'main > section[data-step] .toggle',
  below: 'main > section[data-step] ~ section[data-step]',
};
const EXPLAINER: Target = {
  box: 'main > section:has(details)',
  toggle: 'main details > summary',
  below: 'footer',
};

interface Layout {
  /** the box's height */
  h: number;
  /** the top of the element below, in page coordinates */
  top: number;
}

interface Toggled {
  /** before the click, then every frame, then once settled */
  samples: Layout[];
  /** the box seeked to half of its animation right after the first click, with its computed overflow */
  half: Layout & { overflow: string };
}

/** Clicks the toggle `clicks` times and samples the layout every frame until all motion is idle. */
async function toggleSampled(page: Page, clicks = 1, target = CARD_1): Promise<Toggled> {
  return page.evaluate(
    async ([clicks, t]) => {
      const box = document.querySelector<HTMLElement>(t.box)!;
      const below = document.querySelector<HTMLElement>(t.below)!;
      const layout = () => ({
        h: box.getBoundingClientRect().height,
        top: below.getBoundingClientRect().top + scrollY,
      });
      const samples = [layout()];
      let sampling = true;
      const tick = (): void => {
        samples.push(layout());
        if (sampling) requestAnimationFrame(tick);
      };
      const toggle = document.querySelector<HTMLElement>(t.toggle)!;
      toggle.click();
      const [a] = box.getAnimations();
      let half = { ...layout(), overflow: '' };
      if (a) {
        a.currentTime = Number(a.effect!.getComputedTiming().duration) / 2;
        half = { ...layout(), overflow: getComputedStyle(box).overflow };
        a.currentTime = 0;
      }
      requestAnimationFrame(tick);
      for (let i = 1; i < clicks; i++) {
        // the next click lands mid-animation
        await new Promise((r) => setTimeout(r, 60));
        toggle.click();
      }
      await window.__motionIdle?.();
      sampling = false;
      samples.push(layout());
      return { samples, half };
    },
    [clicks, target] as const,
  );
}

const layoutNow = (page: Page, target = CARD_1): Promise<Layout> =>
  page.evaluate(
    (t) => ({
      h: document.querySelector(t.box)!.getBoundingClientRect().height,
      top: document.querySelector(t.below)!.getBoundingClientRect().top + scrollY,
    }),
    target,
  );

const between = (v: number, a: number, b: number): boolean =>
  v > Math.min(a, b) + 1 && v < Math.max(a, b) - 1;
const inBetween = (s: Layout, from: Layout, to: Layout): boolean =>
  between(s.h, from.h, to.h) && between(s.top, from.top, to.top);

/** Card 1 and the card below move from `from` to `to` over several frames, clipped meanwhile, and settle on `to`. */
function expectGradual({ samples, half }: Toggled, from: Layout, to: Layout): void {
  expect(inBetween(half, from, to)).toBe(true);
  expect(half.overflow).toBe('hidden');
  expect(samples[0]).toEqual(from);
  expect(samples.filter((s) => inBetween(s, from, to)).length).toBeGreaterThanOrEqual(2);
  expect(samples.at(-1)).toEqual(to);
}

test.describe('summary cards with motion', () => {
  test.use({ reducedMotion: 'no-preference' });

  test('a card grows and shrinks smoothly, then settles exactly as with reduced motion', async ({
    page,
  }) => {
    await openCards(page);
    // the end of the wizard does not animate the cards
    expect(await card(page, 1).evaluate((el) => el.getAnimations().length)).toBe(0);
    await waitForMotionIdle(page);
    const collapsed = await layoutNow(page);

    const opening = await toggleSampled(page);
    const expanded = opening.samples.at(-1)!;
    expect(expanded.h).toBeGreaterThan(collapsed.h + 100);
    expectGradual(opening, collapsed, expanded);
    await expect(card(page, 1)).not.toHaveAttribute('style');
    await expect(card(page, 1)).not.toHaveClass(/collapsed/);
    await expect(card(page, 1).locator('.toggle')).toHaveAttribute('aria-expanded', 'true');
    await expect(card(page, 1).locator('.toggle')).toHaveText('Zwiń');

    const closing = await toggleSampled(page);
    expectGradual(closing, expanded, collapsed);
    await expect(card(page, 1)).not.toHaveAttribute('style');
    await expect(card(page, 1)).toHaveClass(/collapsed/);
    await expect(card(page, 1).locator('.toggle')).toHaveAttribute('aria-expanded', 'false');
    await expect(card(page, 1).locator('.toggle')).toHaveText('Zmień');

    // the same toggles with reduced motion land on the same layout at once
    await page.emulateMedia({ reducedMotion: 'reduce' });
    await card(page, 1).locator('.toggle').click();
    expect(await layoutNow(page)).toEqual(expanded);
    await card(page, 1).locator('.toggle').click();
    expect(await layoutNow(page)).toEqual(collapsed);
  });

  test('toggling again mid-animation turns back from the current height', async ({ page }) => {
    await openCards(page);
    await waitForMotionIdle(page);
    const collapsed = await layoutNow(page);
    await page.emulateMedia({ reducedMotion: 'reduce' });
    await card(page, 1).locator('.toggle').click();
    const expanded = await layoutNow(page);
    await card(page, 1).locator('.toggle').click();
    await page.emulateMedia({ reducedMotion: 'no-preference' });

    const { samples } = await toggleSampled(page, 2);
    const highest = Math.max(...samples.map((s) => s.h));
    expect(highest).toBeGreaterThan(collapsed.h + 1);
    expect(highest).toBeLessThan(expanded.h - 1);
    for (let i = 1; i < samples.length; i++)
      expect(Math.abs(samples[i]!.top - samples[i - 1]!.top)).toBeLessThan(
        (expanded.top - collapsed.top) / 2,
      );
    expect(samples.at(-1)).toEqual(collapsed);
    await expect(card(page, 1)).not.toHaveAttribute('style');
    await expect(card(page, 1).locator('.toggle')).toHaveAttribute('aria-expanded', 'false');
  });

  test('in the full form after skipping the wizard, a card shrinks and grows smoothly', async ({
    page,
  }) => {
    await page.setViewportSize({ width: 1280, height: 900 });
    await openApp(page);
    await expect(card(page, 1).locator('.toggle')).toHaveText('Zwiń');
    await waitForMotionIdle(page);
    const expanded = await layoutNow(page);

    const closing = await toggleSampled(page);
    const collapsed = closing.samples.at(-1)!;
    expect(collapsed.h).toBeLessThan(expanded.h - 100);
    expectGradual(closing, expanded, collapsed);
    await expect(card(page, 1)).toHaveClass(/collapsed/);
    await expect(card(page, 1)).not.toHaveAttribute('style');

    const opening = await toggleSampled(page);
    expectGradual(opening, collapsed, expanded);
    await expect(card(page, 1)).not.toHaveClass(/collapsed/);
    await expect(card(page, 1)).not.toHaveAttribute('style');
    await expect(card(page, 1).locator('.toggle')).toHaveAttribute('aria-expanded', 'true');
  });
});

test.describe('explainer with motion', () => {
  test.use({ reducedMotion: 'no-preference' });

  test('"Jak to liczy" opens and closes smoothly, then settles exactly as with reduced motion', async ({
    page,
  }) => {
    await openApp(page);
    const details = page.locator('main details');
    await waitForMotionIdle(page);
    const closed = await layoutNow(page, EXPLAINER);

    const opening = await toggleSampled(page, 1, EXPLAINER);
    const open = opening.samples.at(-1)!;
    expect(open.h).toBeGreaterThan(closed.h + 100);
    expectGradual(opening, closed, open);
    await expect(details).toHaveAttribute('open', '');
    await expect(page.locator(EXPLAINER.box)).not.toHaveAttribute('style');

    const closing = await toggleSampled(page, 1, EXPLAINER);
    expectGradual(closing, open, closed);
    await expect(details).not.toHaveAttribute('open');
    await expect(page.locator(EXPLAINER.box)).not.toHaveAttribute('style');

    await page.emulateMedia({ reducedMotion: 'reduce' });
    await page.locator(EXPLAINER.toggle).click();
    expect(await layoutNow(page, EXPLAINER)).toEqual(open);
    await page.locator(EXPLAINER.toggle).click();
    expect(await layoutNow(page, EXPLAINER)).toEqual(closed);
  });
});

test.describe('summary cards with reduced motion', () => {
  test('a summary card opens and closes at once', async ({ page }) => {
    await openCards(page);
    const toggle = card(page, 1).locator('.toggle');
    await toggle.click();
    expect(await page.evaluate(() => document.getAnimations().length)).toBe(0);
    expect(await helperIdleNow(page)).toBe(true);
    await expect(toggle).toHaveAttribute('aria-expanded', 'true');
    await toggle.click();
    expect(await page.evaluate(() => document.getAnimations().length)).toBe(0);
    expect(await helperIdleNow(page)).toBe(true);
    await expect(card(page, 1)).not.toHaveAttribute('style');
  });

  test('the explainer opens and closes at once', async ({ page }) => {
    await openApp(page);
    const details = page.locator('main details');
    await page.locator(EXPLAINER.toggle).click();
    await expect(details).toHaveAttribute('open', '');
    expect(await page.evaluate(() => document.getAnimations().length)).toBe(0);
    expect(await helperIdleNow(page)).toBe(true);
    await page.locator(EXPLAINER.toggle).click();
    await expect(details).not.toHaveAttribute('open');
    expect(await page.evaluate(() => document.getAnimations().length)).toBe(0);
    await expect(page.locator(EXPLAINER.box)).not.toHaveAttribute('style');
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
