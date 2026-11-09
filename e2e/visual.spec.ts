// Visual regression check of the build, opt-in (VISUAL=1). Baselines are machine-specific and not committed:
//   1. VISUAL=1 npx playwright test e2e/visual.spec.ts --update-snapshots   (baseline from the build)
//   2. VISUAL=1 npx playwright test e2e/visual.spec.ts                      (compare after a change)
// The page uses the self-hosted Inter font; screenshots wait for it to load.
import { expect, test } from '@playwright/test';
import { PROTOTYPE, openApp } from './helpers';
import { STATES } from './states';

test.skip(!process.env.VISUAL, 'set VISUAL=1 to run screenshot comparison');
test.skip(PROTOTYPE, 'the build has its own design; the prototype is no longer a visual reference');

const sizes = { desktop: { width: 1280, height: 900 }, mobile: { width: 375, height: 812 } } as const;

for (const [size, viewport] of Object.entries(sizes)) {
  for (const [name, setup] of Object.entries(STATES)) {
    test(`${size} ${name}`, async ({ page }) => {
      await page.setViewportSize(viewport);
      await openApp(page);
      await setup(page);
      await page.evaluate(() => document.fonts.ready);
      // VISUAL_STRICT=1 demands pixel-identical output
      const tolerance = process.env.VISUAL_STRICT ? { maxDiffPixels: 0, threshold: 0 } : { maxDiffPixelRatio: 0.001 };
      await expect(page).toHaveScreenshot(`${size}-${name}.png`, { fullPage: true, ...tolerance });
    });
  }
}
