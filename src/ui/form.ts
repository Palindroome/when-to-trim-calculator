import type { ConditionsSource } from '../domain/conditions';
import {
  COVERS,
  type AirflowId,
  type BatId,
  type ClayId,
  type Conditions,
  type Cover,
  type PieceInput,
  type ShapeId,
  type StageId,
  type WetnessId,
} from '../domain/types';
import type { Formatter, Messages } from '../i18n';
import { byId } from './dom';

/** Parses a number field, accepting a decimal comma; falls back when not a finite number. */
export function parseNumber(raw: string, fallback: number): number {
  const v = parseFloat(String(raw).trim().replaceAll(',', '.'));
  return isFinite(v) ? v : fallback;
}

const pad = (n: number): string => String(n).padStart(2, '0');

/** Local calendar day as `YYYY-MM-DD`: the stored day of a picker and the calendar's value. */
export const toDayKey = (d: Date): string => `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;

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
  if (isNaN(day.getTime())) return '';
  const relative: Record<number, string> = { [-1]: m.dateTime.yesterday, 0: m.dateTime.today, 1: m.dateTime.tomorrow };
  for (const offset of [-1, 0, 1]) {
    const d = new Date(nowMs);
    d.setHours(12, 0, 0, 0); // midday: adding a day never lands in a neighbouring day on DST changes
    d.setDate(d.getDate() + offset);
    if (toDayKey(d) === dayKey) return m.dateTime.relativeDay(relative[offset]!, fmt.date(day.getTime()));
  }
  return fmt.date(day.getTime());
}

const value = (id: string): string => byId<HTMLInputElement | HTMLSelectElement>(id).value;
const num = (id: string, fallback: number): number => parseNumber(value(id), fallback);

export function readPieceInput(): PieceInput {
  const wallMm = num('wall', 6);
  const base = num('base', NaN);
  return {
    massG: num('mass', 500),
    shape: value('shape') as ShapeId,
    wallMm,
    baseMm: isFinite(base) ? base : undefined,
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
      temp: num('temp', 20),
      rh: num('rh', 50),
      airflow: value('air') as AirflowId,
      night: byId<HTMLInputElement>('night').checked,
      nightTemp: num('ntemp', 15),
      nightRh: num('nrh', 60),
      dampTemp: num('dtemp', 15),
      dampRh: num('drh', 88),
    };
  },
};

/** The two day + time pickers in section 3: the day key is kept in `<id>-day`, the typed time in `<id>-time`. */
export type DateTimeId = 'thrown' | 'when';

const readDateTime = (id: DateTimeId): number => combineLocalDateTime(value(`${id}-day`), value(`${id}-time`));

/** Throwing time; an empty/invalid field means "now". */
export const readThrownMs = (nowMs: number): number => readDateTime('thrown') || nowMs;

/** Wanted trim time (NaN when empty or invalid). */
export const readWhenMs = (): number => readDateTime('when');

export const readName = (): string => value('name').trim();

/** Covers ticked in "Sposoby okrycia, których mogę użyć", in COVERS order. */
export function readAllowedCovers(): Cover[] {
  const checked = new Set(
    [...document.querySelectorAll<HTMLInputElement>('input[data-cover]')].filter((e) => e.checked).map((e) => e.dataset.cover),
  );
  return COVERS.filter((c) => checked.has(c));
}

/** Mass check inputs; thrown mass falls back to 0 (not 500) here, so an empty field hides the check. */
export const readWeightInputs = (): { thrownMassG: number; currentMassG: number; cover: Cover } => ({
  thrownMassG: num('mass', 0),
  currentMassG: num('mnow', NaN),
  cover: value('wnow') as Cover,
});
