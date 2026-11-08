// Golden-master check: for each input scenario, the whole result area
// (recommendation, window, bars, bar geometry, legend, alternatives, tips, save button)
// must match what the original prototype produced, except scenarios marked
// prototypeDiffers (intended fixes). See record.spec.ts.
import { expect, test } from '@playwright/test';
import { readFileSync } from 'node:fs';
import { PROTOTYPE, openApp, snapshot, type Snapshot } from './helpers';
import { SCENARIOS, applySteps } from './scenarios';

const GOLDEN = JSON.parse(
  readFileSync(new URL('./golden.json', import.meta.url), 'utf-8'),
) as Record<string, Snapshot>;

test('every scenario has a recorded expectation', () => {
  expect(Object.keys(GOLDEN).sort()).toEqual(SCENARIOS.map((s) => s.name).sort());
});

for (const s of SCENARIOS) {
  test(`result: ${s.name}`, async ({ page }) => {
    test.skip(PROTOTYPE && !!s.prototypeDiffers, s.prototypeDiffers);
    await openApp(page);
    await applySteps(page, s.steps);
    expect(await snapshot(page)).toEqual(GOLDEN[s.name]);
  });
}
