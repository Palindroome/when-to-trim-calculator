import { expect, type Locator, type Page } from '@playwright/test';

/** Fixed "now" for every test: Wednesday 4 March 2026, 09:00 in Europe/Warsaw (CET, +01:00). */
export const NOW = '2026-03-04T09:00:00+01:00';
export const STORAGE_KEY = 'kiedy-trymowac-v1';
export const WIZARD_KEY = 'kiedy-trymowac-wizard';

export async function openApp(page: Page, opts: { now?: string; storage?: string | null; wizard?: boolean } = {}): Promise<void> {
  await page.clock.setFixedTime(new Date(opts.now ?? NOW));
  // Most tests need the full, expanded form: mark the first-run wizard as skipped unless the test is about it.
  if (!opts.wizard) {
    await page.addInitScript((key) => {
      if (localStorage.getItem(key) === null) localStorage.setItem(key, 'skipped');
    }, WIZARD_KEY);
  }
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
  | 'Masa teraz';

/** The two day + time pickers in "3 Termin", by their Polish legend. */
export type DateField = 'Wytoczona' | 'Chcę trymować';
const DATE_IDS: Record<DateField, string> = { Wytoczona: 'thrown', 'Chcę trymować': 'when' };

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

/** The calendar dialog of a picker, and a day button in it by its day of the month. */
export const calendarDialog = (page: Page, label: DateField): Locator => page.locator(`#${DATE_IDS[label]}-cal`);
export const calendarDay = (page: Page, label: DateField, dayOfMonth: number): Locator =>
  calendarDialog(page, label).locator('calendar-month button[part~="day"]', { hasText: new RegExp(`^${dayOfMonth}$`) });

/**
 * Sets a picker as a user would, from `YYYY-MM-DDTHH:mm`: opens the calendar from the day button, pages to
 * the month, clicks the day, then types the time. An empty value clears the time (an unreadable date-time).
 */
export async function setDateTime(page: Page, label: DateField, value: string): Promise<void> {
  const id = DATE_IDS[label];
  const [day = '', time = ''] = value.split('T');
  if (day) {
    const [current = ''] = (await dateTimeValue(page, label)).split('T');
    const month = (key: string): number => Number(key.slice(0, 4)) * 12 + Number(key.slice(5, 7));
    const pages = month(day) - month(current);
    await page.locator(`#${id}-day-btn`).click();
    const dialog = calendarDialog(page, label);
    await expect(dialog).toBeVisible();
    for (let i = 0; i < Math.abs(pages); i++) {
      await dialog.locator(`[part~="${pages > 0 ? 'next' : 'previous'}"]`).click();
    }
    await calendarDay(page, label, Number(day.slice(8, 10))).click();
    await expect(dialog).toBeHidden();
  }
  await page.locator(`#${id}-time`).fill(time);
}

/** The picker's value as `YYYY-MM-DDTHH:mm` (the stored day key and the typed time). */
export async function dateTimeValue(page: Page, label: DateField): Promise<string> {
  return page.evaluate((id) => {
    const value = (part: string): string => (document.getElementById(`${id}-${part}`) as HTMLInputElement).value;
    return `${value('day')}T${value('time')}`;
  }, DATE_IDS[label]);
}

export async function expectDateTime(page: Page, label: DateField, value: string): Promise<void> {
  await expect.poll(() => dateTimeValue(page, label)).toBe(value);
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
export async function snapshot(page: Page, saveLabel = 'Zapisz tę pracę z planem'): Promise<Snapshot> {
  const result = page.locator('#result');
  const text = async (sel: string): Promise<string> => {
    const l = result.locator(sel);
    return (await l.count()) ? norm(await l.first().innerText()) : '';
  };
  // textContent: CSS such as text-transform must not leak into the behavioural golden
  const raw = async (sel: string): Promise<string> => {
    const l = result.locator(sel);
    return (await l.count()) ? norm((await l.first().textContent()) ?? '') : '';
  };
  const all = async (sel: string): Promise<string[]> =>
    (await result.locator(sel).allInnerTexts()).map(norm);
  return {
    kind: await raw('.rec .k'),
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
    save: (await page.getByRole('button', { name: saveLabel }).count()) === 1,
  };
}

/**
 * WCAG 2.x contrast ratio between two colour tokens (custom properties on :root), as currently computed.
 * Any CSS colour syntax works, so the same check serves every colour scheme.
 */
export async function tokenContrast(page: Page, fg: string, bg: string): Promise<number> {
  const [a, b] = await page.evaluate(
    (tokens) =>
      tokens.map((token) => {
        const value = getComputedStyle(document.documentElement).getPropertyValue(token).trim();
        if (!value) throw new Error(`token ${token} is not defined`);
        return value;
      }),
    [fg, bg],
  );
  return colorContrast(page, a!, b!);
}

/** A computed colour property of the first element matching `selector`, e.g. `['.fill', 'backgroundColor']`. */
export type ElementColor = [selector: string, property: 'color' | 'backgroundColor' | 'borderTopColor'];

/** WCAG 2.x contrast ratio between colours of rendered elements, so a component that bypasses the tokens is caught too. */
export async function elementContrast(page: Page, fg: ElementColor, bg: ElementColor): Promise<number> {
  const [a, b] = await page.evaluate(
    (refs) =>
      refs.map(([selector, property]) => {
        const el = document.querySelector(selector);
        if (!el) throw new Error(`${selector} not found`);
        return getComputedStyle(el)[property];
      }),
    [fg, bg],
  );
  return colorContrast(page, a!, b!);
}

/** WCAG 2.x contrast ratio between two opaque CSS colours, parsed by the browser. */
async function colorContrast(page: Page, fg: string, bg: string): Promise<number> {
  return page.evaluate(
    ([a, b]) => {
      const luminance = (value: string): number => {
        const ctx = document.createElement('canvas').getContext('2d')!;
        ctx.fillStyle = value;
        ctx.fillRect(0, 0, 1, 1);
        const [r, g, bl] = [...ctx.getImageData(0, 0, 1, 1).data].map((c) => {
          const s = c / 255;
          return s <= 0.04045 ? s / 12.92 : ((s + 0.055) / 1.055) ** 2.4;
        });
        return 0.2126 * r! + 0.7152 * g! + 0.0722 * bl!;
      };
      const [l1, l2] = [luminance(a), luminance(b)].sort((x, y) => y - x);
      return (l1! + 0.05) / (l2! + 0.05);
    },
    [fg, bg] as const,
  );
}
