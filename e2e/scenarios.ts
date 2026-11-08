import type { Page } from '@playwright/test';
import { choose, field, fill, setNight, type Field, type SelectField } from './helpers';

export type Step =
  | { fill: Field; value: string }
  | { type: Field; value: string }
  | { select: SelectField; value: string }
  | { night: boolean }
  | { chip: string };

export interface Scenario {
  name: string;
  steps: Step[];
}

export async function applySteps(page: Page, steps: Step[]): Promise<void> {
  for (const s of steps) {
    if ('fill' in s) await fill(page, s.fill, s.value);
    else if ('type' in s) {
      const input = field(page, s.type);
      await input.fill('');
      await input.pressSequentially(s.value);
    }
    else if ('select' in s) await choose(page, s.select, s.value);
    else if ('night' in s) await setNight(page, s.night);
    else await page.locator('#quick').getByRole('button', { name: s.chip, exact: true }).click();
  }
}

const when = (value: string): Step => ({ fill: 'Chcę trymować', value });

/**
 * Input combinations whose full result area is pinned in golden.ts.
 * Covers every select option, the numeric clamps, comma decimals, night mode,
 * damp-room gating, all three recommendation kinds and every error message.
 */
export const SCENARIOS: Scenario[] = [
  { name: 'defaults', steps: [] },
  { name: 'chip jutro', steps: [{ chip: 'jutro' }] },
  { name: 'chip za 3 dni', steps: [{ chip: 'za 3 dni' }] },
  { name: 'chip za 5 dni (damp allowed)', steps: [{ chip: 'za 5 dni' }] },
  { name: 'chip za tydzień', steps: [{ chip: 'za tydzień' }] },
  { name: 'when equals thrown (error)', steps: [when('2026-03-04T09:00')] },
  { name: 'when before thrown (error)', steps: [when('2026-03-03T09:00')] },
  { name: 'deadline in 2 hours (too fast error)', steps: [when('2026-03-04T11:00')] },
  { name: 'deadline in 8 hours', steps: [when('2026-03-04T17:00')] },
  { name: 'deadline in 30 minutes', steps: [when('2026-03-04T09:30')] },
  { name: 'exactly 4 days (damp boundary)', steps: [when('2026-03-08T09:00')] },
  { name: 'just under 4 days', steps: [when('2026-03-08T08:45')] },
  { name: 'long wait 20 days', steps: [when('2026-03-24T10:00')] },
  { name: 'very long wait 40 days', steps: [when('2026-04-13T10:00')] },
  {
    name: 'hot dry draft, small plate, long wait (tightest error)',
    steps: [
      { fill: 'Temperatura w pracowni', value: '35' },
      { fill: 'Wilgotność powietrza', value: '10' },
      { select: 'Ruch powietrza przy półce', value: 'draft' },
      { select: 'Kształt', value: 'plate' },
      { fill: 'Masa po toczeniu', value: '100' },
      { fill: 'Grubość ścianki', value: '3' },
      { fill: 'Grubość dna', value: '3' },
      { select: 'Podłoże', value: 'plaster' },
      { chip: 'za tydzień' },
    ],
  },
  { name: 'stage soft', steps: [{ select: 'Na co ma być gotowa', value: 'soft' }] },
  { name: 'stage hard', steps: [{ select: 'Na co ma być gotowa', value: 'hard' }] },
  { name: 'wet dry', steps: [{ select: 'Mokrość po toczeniu', value: 'dry' }] },
  { name: 'wet very wet', steps: [{ select: 'Mokrość po toczeniu', value: 'wet' }] },
  { name: 'shape bowl', steps: [{ select: 'Kształt', value: 'bowl' }] },
  { name: 'shape plate', steps: [{ select: 'Kształt', value: 'plate' }] },
  { name: 'shape vase', steps: [{ select: 'Kształt', value: 'vase' }] },
  { name: 'shape closed (slow tip)', steps: [{ select: 'Kształt', value: 'closed' }] },
  { name: 'clay grog', steps: [{ select: 'Masa ceramiczna', value: 'grog' }] },
  { name: 'clay porcelain', steps: [{ select: 'Masa ceramiczna', value: 'porc' }] },
  { name: 'clay earthenware', steps: [{ select: 'Masa ceramiczna', value: 'earth' }] },
  { name: 'bat plastic', steps: [{ select: 'Podłoże', value: 'plastic' }] },
  { name: 'bat plaster', steps: [{ select: 'Podłoże', value: 'plaster' }] },
  { name: 'air still', steps: [{ select: 'Ruch powietrza przy półce', value: 'still' }] },
  { name: 'air draft (draft tip)', steps: [{ select: 'Ruch powietrza przy półce', value: 'draft' }] },
  {
    name: 'dry warm air (vpd tip)',
    steps: [
      { fill: 'Temperatura w pracowni', value: '26' },
      { fill: 'Wilgotność powietrza', value: '30' },
    ],
  },
  {
    name: 'rh above 100 unclamped in tips',
    steps: [{ fill: 'Wilgotność powietrza', value: '120' }],
  },
  { name: 'rh 0', steps: [{ fill: 'Wilgotność powietrza', value: '0' }] },
  { name: 'cold room', steps: [{ fill: 'Temperatura w pracowni', value: '5' }] },
  { name: 'thick base (slow tip)', steps: [{ fill: 'Grubość dna', value: '25' }] },
  { name: 'base thinner than wall', steps: [{ fill: 'Grubość dna', value: '3' }] },
  { name: 'base empty falls back to wall', steps: [{ fill: 'Grubość dna', value: '' }] },
  { name: 'wall typed with comma 6,5', steps: [{ type: 'Grubość ścianki', value: '6,5' }] },
  { name: 'wall decimal 6.5', steps: [{ fill: 'Grubość ścianki', value: '6.5' }] },
  { name: 'wall below minimum clamps to 2', steps: [{ fill: 'Grubość ścianki', value: '1' }] },
  { name: 'mass empty falls back to 500', steps: [{ fill: 'Masa po toczeniu', value: '' }] },
  { name: 'mass below minimum clamps to 20', steps: [{ fill: 'Masa po toczeniu', value: '5' }] },
  { name: 'mass 2000', steps: [{ fill: 'Masa po toczeniu', value: '2000' }] },
  { name: 'temp empty falls back to 20', steps: [{ fill: 'Temperatura w pracowni', value: '' }] },
  {
    name: 'night mode on',
    steps: [{ night: true }],
  },
  {
    name: 'night mode with custom night values',
    steps: [
      { night: true },
      { fill: 'Temperatura nocą (22–7)', value: '10' },
      { fill: 'Wilgotność nocą', value: '80' },
    ],
  },
  {
    name: 'night values ignored when night off',
    steps: [
      { night: true },
      { fill: 'Temperatura nocą (22–7)', value: '5' },
      { night: false },
    ],
  },
  {
    name: 'damp room custom, stage soft',
    steps: [
      { select: 'Na co ma być gotowa', value: 'soft' },
      { fill: 'Mokra przechowalnia: temp.', value: '12' },
      { fill: 'Mokra przechowalnia: wilg.', value: '95' },
    ],
  },
  {
    name: 'thrown earlier, trim tomorrow',
    steps: [
      { fill: 'Wytoczona', value: '2026-03-02T18:30' },
      { chip: 'jutro' },
    ],
  },
  {
    name: 'big porcelain closed form, long wait (mould tip)',
    steps: [
      { select: 'Masa ceramiczna', value: 'porc' },
      { select: 'Kształt', value: 'closed' },
      { fill: 'Masa po toczeniu', value: '1500' },
      { fill: 'Grubość dna', value: '20' },
      { select: 'Podłoże', value: 'plastic' },
      when('2026-03-14T10:00'),
    ],
  },
];
