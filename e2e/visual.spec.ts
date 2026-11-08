// Visual parity check, opt-in (VISUAL=1). Baselines are machine-specific and not committed:
//   1. VISUAL=1 E2E_TARGET=prototype npx playwright test e2e/visual.spec.ts --update-snapshots
//   2. VISUAL=1 npx playwright test e2e/visual.spec.ts
// Web fonts are blocked in both runs (see openApp), so font loading cannot cause diffs.
import { expect, test, type Page } from '@playwright/test';
import { fill, openApp, setNight } from './helpers';

test.skip(!process.env.VISUAL, 'set VISUAL=1 to run screenshot comparison');

const sizes = { desktop: { width: 1280, height: 900 }, mobile: { width: 375, height: 812 } } as const;

const states: Record<string, (page: Page) => Promise<void>> = {
  default: async () => {},
  'night-weight': async (page) => {
    await setNight(page, true);
    await fill(page, 'Masa teraz', '490');
  },
  error: async (page) => {
    await fill(page, 'Chcę trymować', '2026-03-01T10:00');
  },
  'tips-and-pieces': async (page) => {
    await page.getByLabel('Kształt', { exact: true }).selectOption('closed');
    await page.getByLabel('Ruch powietrza przy półce', { exact: true }).selectOption('draft');
    await page.getByRole('button', { name: 'Zapisz tę pracę z planem' }).click();
    await page.clock.setFixedTime(new Date('2026-03-06T11:00:00+01:00'));
    await page.getByRole('button', { name: 'w sam raz' }).click();
    await page.getByRole('button', { name: 'za tydzień' }).click();
    await page.getByRole('button', { name: 'Zapisz tę pracę z planem' }).click();
    await page.locator('details summary').click();
    await page.evaluate(() => window.scrollTo(0, 0));
  },
};

for (const [size, viewport] of Object.entries(sizes)) {
  for (const [name, setup] of Object.entries(states)) {
    test(`${size} ${name}`, async ({ page }) => {
      await page.setViewportSize(viewport);
      await openApp(page);
      await setup(page);
      // VISUAL_STRICT=1 demands pixel-identical output
      const tolerance = process.env.VISUAL_STRICT ? { maxDiffPixels: 0, threshold: 0 } : { maxDiffPixelRatio: 0.001 };
      await expect(page).toHaveScreenshot(`${size}-${name}.png`, { fullPage: true, ...tolerance });
    });
  }
}
