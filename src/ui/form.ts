import type { ConditionsSource } from '../domain/conditions';
import type { CoverDefinition, CoverId } from '../domain/covers';
import type {
  AirflowId,
  BatId,
  ClayId,
  Conditions,
  PieceInput,
  ShapeId,
  StageId,
  WetnessId,
} from '../domain/types';
import type { Formatter, Messages } from '../i18n';
import { byId } from './dom';

/** Parses a number field, accepting a decimal comma; falls back when not a finite number. */
export function parseNumber(raw: string, fallback: number): number {
  const v = parseFloat(String(raw).trim().replaceAll(',', '.'));
  return Number.isFinite(v) ? v : fallback;
}

/** The typed number fields; the ids of their inputs. */
export type NumberFieldId =
  | 'mass'
  | 'wall'
  | 'base'
  | 'mnow'
  | 'temp'
  | 'rh'
  | 'ntemp'
  | 'nrh'
  | 'dtemp'
  | 'drh';

interface NumberField {
  /** the value used while the field is empty */
  fallback: number;
  min: number;
  max: number;
  /** the minimum itself is out of range */
  minExclusive?: boolean;
  /** the `validation` message shown for a value out of range */
  message: 'positive' | 'percent' | 'tempRange';
}

const positive = (fallback: number): NumberField => ({
  fallback,
  min: 0,
  max: Infinity,
  minExclusive: true,
  message: 'positive',
});
const percent = (fallback: number): NumberField => ({
  fallback,
  min: 0,
  max: 100,
  message: 'percent',
});
/** Not a realistic range: it only keeps the model defined (saturation pressure has a pole at −243.12 °C). */
const temperature = (fallback: number): NumberField => ({
  fallback,
  min: -200,
  max: 200,
  message: 'tempRange',
});

/** Input rules of the number fields. The domain still clamps to its own minimums behind them. */
export const NUMBER_FIELDS: Record<NumberFieldId, NumberField> = {
  mass: positive(500),
  wall: positive(6),
  base: positive(NaN),
  mnow: positive(NaN),
  temp: temperature(20),
  rh: percent(50),
  ntemp: temperature(15),
  nrh: percent(60),
  dtemp: temperature(15),
  drh: percent(88),
};

const NUMBER_IDS = Object.keys(NUMBER_FIELDS) as NumberFieldId[];

export const isNumberField = (id: string): id is NumberFieldId => id in NUMBER_FIELDS;

/** A plain decimal number, with a dot or a comma. */
const NUMBER_PATTERN = /^[+-]?(\d+([.,]\d*)?|[.,]\d+)$/;

export type NumberCheck = 'ok' | 'empty' | 'nan' | 'range';

/** Checks a typed value against its field's rule; an empty field is not an error. */
export function validateNumber(id: NumberFieldId, raw: string): NumberCheck {
  const s = raw.trim();
  if (s === '') return 'empty';
  if (!NUMBER_PATTERN.test(s)) return 'nan';
  const v = parseNumber(s, NaN);
  const f = NUMBER_FIELDS[id];
  const aboveMin = f.minExclusive ? v > f.min : v >= f.min;
  return aboveMin && v <= f.max ? 'ok' : 'range';
}

function numberMessage(m: Messages, id: NumberFieldId, check: NumberCheck): string {
  const f = NUMBER_FIELDS[id];
  if (check === 'nan') return m.validation.notNumber;
  return f.message === 'tempRange' ? m.validation.tempRange(f.min, f.max) : m.validation[f.message];
}

/**
 * Flags a number field that is out of range or, once left (`done`), cannot be read; true when flagged.
 * While typing, unreadable text is not newly reported, so a half-typed "-" is not flagged.
 * The night fields count only while the night switch shows them.
 */
export function checkNumber(m: Messages, id: NumberFieldId, done: boolean): boolean {
  const input = byId<HTMLInputElement>(id);
  const msg = byId(`${id}-msg`);
  const hidden = (id === 'ntemp' || id === 'nrh') && !byId<HTMLInputElement>('night').checked;
  const check = hidden ? 'ok' : validateNumber(id, input.value);
  const invalid =
    check === 'range' || (check === 'nan' && (done || input.hasAttribute('aria-invalid')));
  msg.classList.toggle('hide', !invalid);
  if (invalid) {
    msg.textContent = numberMessage(m, id, check);
    input.setAttribute('aria-invalid', 'true');
    input.setAttribute('aria-describedby', `${id}-msg`);
  } else {
    msg.textContent = '';
    input.removeAttribute('aria-invalid');
    input.removeAttribute('aria-describedby');
  }
  return invalid;
}

/** Checks every number field (see `checkNumber`); true when any is flagged. */
export const checkNumbers = (m: Messages, done: boolean): boolean =>
  NUMBER_IDS.map((id) => checkNumber(m, id, done)).includes(true);

/** The inline message under a number field, filled by `checkNumber`. */
export const numberMessageMarkup = (id: NumberFieldId): string =>
  `<p class="field-msg hide" id="${id}-msg"></p>`;

const pad = (n: number): string => String(n).padStart(2, '0');

/** Local calendar day as `YYYY-MM-DD`: the stored day of a picker and the calendar's value. */
export const toDayKey = (d: Date): string =>
  `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;

/** Local time as 24 h `HH:MM`. */
export const toTime = (d: Date): string => `${pad(d.getHours())}:${pad(d.getMinutes())}`;

/** Reads a typed 24 h time ("9", "917", "9:17", "9.17", "09:17", ...) as `HH:MM`; null when it is not a valid time. */
export function normalizeTime(raw: string): string | null {
  const match = /^(\d{1,2})(?:[:.]?(\d{2}))?$/.exec(raw.trim());
  if (!match) return null;
  const h = Number(match[1]);
  const min = Number(match[2] ?? 0);
  return h < 24 && min < 60 ? `${pad(h)}:${pad(min)}` : null;
}

/** Epoch ms of a local day key and a typed time, parsed like the former `datetime-local` value; NaN when invalid. */
export function combineLocalDateTime(dayKey: string, time: string): number {
  const t = normalizeTime(time);
  return t ? new Date(`${dayKey}T${t}`).getTime() : NaN;
}

/** A day key labelled from the catalog, with a relative word next to yesterday, today and tomorrow: "dziś · śr 4.03". */
export function dayLabel(m: Messages, fmt: Formatter, dayKey: string, nowMs: number): string {
  const day = new Date(`${dayKey}T12:00`);
  if (Number.isNaN(day.getTime())) return '';
  const relative: Record<number, string> = {
    [-1]: m.dateTime.yesterday,
    0: m.dateTime.today,
    1: m.dateTime.tomorrow,
  };
  for (const offset of [-1, 0, 1]) {
    const d = new Date(nowMs);
    d.setHours(12, 0, 0, 0); // midday: adding a day never lands in a neighbouring day on DST changes
    d.setDate(d.getDate() + offset);
    if (toDayKey(d) === dayKey)
      return m.dateTime.relativeDay(relative[offset]!, fmt.date(day.getTime()));
  }
  return fmt.date(day.getTime());
}

const value = (id: string): string => byId<HTMLInputElement | HTMLSelectElement>(id).value;
const num = (id: NumberFieldId, fallback = NUMBER_FIELDS[id].fallback): number =>
  parseNumber(value(id), fallback);

export function readPieceInput(): PieceInput {
  const wallMm = num('wall');
  const base = num('base');
  return {
    massG: num('mass'),
    shape: value('shape') as ShapeId,
    wallMm,
    baseMm: Number.isFinite(base) ? base : undefined,
    clay: value('clay') as ClayId,
    bat: value('bat') as BatId,
    wetness: value('wet') as WetnessId,
    stage: value('stage') as StageId,
  };
}

/** Conditions typed into the form. A sensor-backed source can replace or wrap this one. */
export const formConditionsSource: ConditionsSource = {
  read(): Conditions {
    return {
      temp: num('temp'),
      rh: num('rh'),
      airflow: value('air') as AirflowId,
      night: byId<HTMLInputElement>('night').checked,
      nightTemp: num('ntemp'),
      nightRh: num('nrh'),
      dampTemp: num('dtemp'),
      dampRh: num('drh'),
    };
  },
};

/** The two day + time pickers in section 3: the day key is kept in `<id>-day`, the typed time in `<id>-time`. */
export type DateTimeId = 'thrown' | 'when';

const readDateTime = (id: DateTimeId): number =>
  combineLocalDateTime(value(`${id}-day`), value(`${id}-time`));

/** Throwing time; an empty/invalid field means "now". */
export const readThrownMs = (nowMs: number): number => readDateTime('thrown') || nowMs;

/** Wanted trim time (NaN when empty or invalid). */
export const readWhenMs = (): number => readDateTime('when');

export const readName = (): string => value('name').trim();

/** Covers ticked in "Sposoby okrycia, których mogę użyć", in catalog order. */
export function readAllowedCovers(covers: readonly CoverDefinition[]): CoverId[] {
  const checked = new Set(
    [...document.querySelectorAll<HTMLInputElement>('input[data-cover]')]
      .filter((e) => e.checked)
      .map((e) => e.dataset.cover),
  );
  return covers.map((c) => c.id).filter((c) => checked.has(c));
}

/** Mass check inputs; thrown mass falls back to 0 (not 500) here, so an empty field hides the check. */
export const readWeightInputs = (): {
  thrownMassG: number;
  currentMassG: number;
  cover: CoverId;
} => ({
  thrownMassG: num('mass', 0),
  currentMassG: num('mnow'),
  cover: value('wnow') as CoverId,
});
