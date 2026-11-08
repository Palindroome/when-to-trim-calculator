// Re-records e2e/golden.json from whatever app the config points at.
// Only runs on demand:  RECORD_GOLDEN=1 npx playwright test e2e/record.spec.ts
// Use it deliberately (e.g. after an intended model change) and review the diff.
import { test } from '@playwright/test';
import { writeFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { openApp, snapshot } from './helpers';
import { SCENARIOS, applySteps } from './scenarios';

test('record golden snapshots', async ({ page }) => {
  test.skip(!process.env.RECORD_GOLDEN, 'set RECORD_GOLDEN=1 to re-record');
  test.setTimeout(300_000);
  const out: Record<string, unknown> = {};
  for (const s of SCENARIOS) {
    await page.unrouteAll();
    await openApp(page);
    await applySteps(page, s.steps);
    out[s.name] = await snapshot(page);
  }
  writeFileSync(fileURLToPath(new URL('./golden.json', import.meta.url)), JSON.stringify(out, null, 2) + '\n');
});
