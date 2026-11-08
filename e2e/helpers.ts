import { expect, type Locator, type Page } from '@playwright/test';

/** Fixed "now" for every test: Wednesday 4 March 2026, 09:00 in Europe/Warsaw (CET, +01:00). */
export const NOW = '2026-03-04T09:00:00+01:00';
export const STORAGE_KEY = 'kiedy-trymowac-v1';
/** True when the suite runs against reference/index.html; tests for intended fixes skip there. */
export const PROTOTYPE = process.env.E2E_TARGET === 'prototype';

export async function openApp(page: Page, opts: { now?: string; storage?: string | null } = {}): Promise<void> {
  await page.clock.setFixedTime(new Date(opts.now ?? NOW));
  // Keep the test hermetic: external web fonts are not needed for behaviour.
  await page.route(/fonts\.(googleapis|gstatic)\.com/, (route) => route.abort());
  if (opts.storage !== undefined && opts.storage !== null) {
    await page.addInitScript(
      ([key, value]) => {
        if (!sessionStorage.getItem('__seeded')) {
          localStorage.setItem(key, value);
          sessionStorage.setItem('__seeded', '1');
        }
      },
      [STORAGE_KEY, opts.storage] as const,
    );
  }
  await page.goto('./');
  await expect(page.locator('#result .bar')).toHaveCount(5);
}

export type Field =
  | 'Nazwa (opcjonalnie)'
  | 'Masa po toczeniu'
  | 'Grubość ścianki'
  | 'Grubość dna'
  | 'Temperatura w pracowni'
  | 'Wilgotność powietrza'
  | 'Temperatura nocą (22–7)'
  | 'Wilgotność nocą'
  | 'Mokra przechowalnia: temp.'
  | 'Mokra przechowalnia: wilg.'
  | 'Wytoczona'
  | 'Chcę trymować'
  | 'Masa teraz';

export type SelectField =
  | 'Kształt'
  | 'Masa ceramiczna'
  | 'Podłoże'
  | 'Mokrość po toczeniu'
  | 'Na co ma być gotowa'
  | 'Ruch powietrza przy półce'
  | 'Przez ten czas była';

export function field(page: Page, label: Field | SelectField): Locator {
  return page.getByLabel(label, { exact: true });
}

export async function fill(page: Page, label: Field, value: string): Promise<void> {
  await field(page, label).fill(value);
}

export async function choose(page: Page, label: SelectField, value: string): Promise<void> {
  await field(page, label).selectOption(value);
}

export async function setNight(page: Page, on: boolean): Promise<void> {
  await page.getByLabel('W nocy jest chłodniej (np. ogrzewanie wyłączone)').setChecked(on);
}

export interface Snapshot {
  kind: string;
  big: string;
  sub: string;
  win: string;
  bars: string[];
  /** Per bar: fill width (inline style), whether highlighted as on-target, and the deadline marker position. */
  tracks: string[];
  legend: string;
  alts: string[];
  tips: string[];
  save: boolean;
}

const norm = (s: string): string => s.replace(/\s+/g, ' ').trim();

/** Collects the whole visible result area into plain strings. */
export async function snapshot(page: Page): Promise<Snapshot> {
  const result = page.locator('#result');
  const text = async (sel: string): Promise<string> => {
    const l = result.locator(sel);
    return (await l.count()) ? norm(await l.first().innerText()) : '';
  };
  const all = async (sel: string): Promise<string[]> =>
    (await result.locator(sel).allInnerTexts()).map(norm);
  return {
    kind: await text('.rec .k'),
    big: await text('.rec .big'),
    sub: await text('.rec .sub'),
    win: await text('.rec .win'),
    bars: await all('.bar'),
    tracks: await result.locator('.bar .track').evaluateAll((els) =>
      els.map((el) => {
        const fill = el.querySelector<HTMLElement>('.fill');
        const target = el.querySelector<HTMLElement>('.target');
        const w = fill ? fill.style.width : '?';
        const good = fill?.classList.contains('good') ? ' good' : '';
        const t = target ? ` | target ${target.style.left}` : ' | no target';
        return `${w}${good}${t}`;
      }),
    ),
    legend: await text('.legend'),
    alts: await all('.alt li'),
    tips: await all('.tip'),
    save: (await page.getByRole('button', { name: 'Zapisz tę pracę z planem' }).count()) === 1,
  };
}
