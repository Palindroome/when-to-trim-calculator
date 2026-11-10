// Golden-master check: for each input scenario, the whole result area
// (recommendation, window, bars, bar geometry, legend, alternatives, tips, save button)
// must match the snapshot recorded from the build in golden.json. Re-record it
// with record.spec.ts when outputs change on purpose.
import { expect, test } from '@playwright/test';
import { readFileSync } from 'node:fs';
import { openApp, snapshot, type Snapshot } from './helpers';
import { SCENARIOS, applySteps } from './scenarios';

const GOLDEN = JSON.parse(
  readFileSync(new URL('./golden.json', import.meta.url), 'utf-8'),
) as Record<string, Snapshot>;

test('every scenario has a recorded expectation', () => {
  expect(Object.keys(GOLDEN).sort()).toEqual(SCENARIOS.map((s) => s.name).sort());
});

for (const s of SCENARIOS) {
  test(`result: ${s.name}`, async ({ page }) => {
    await openApp(page);
    await applySteps(page, s.steps);
    expect(await snapshot(page)).toEqual(GOLDEN[s.name]);
  });
}
