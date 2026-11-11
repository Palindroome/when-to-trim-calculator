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
import { byId } from './dom';

/** Parses a number field, accepting a decimal comma; falls back when not a finite number. */
export function parseNumber(raw: string, fallback: number): number {
  const v = parseFloat(String(raw).trim().replaceAll(',', '.'));
  return isFinite(v) ? v : fallback;
}

/** Formats a date for a `datetime-local` input (local time, minutes precision). */
export function toLocalInput(d: Date): string {
  const pad = (n: number): string => String(n).padStart(2, '0');
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`;
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

/** Throwing time; an empty/invalid field means "now". */
export const readThrownMs = (nowMs: number): number => new Date(value('thrown')).getTime() || nowMs;

/** Wanted trim time (NaN when empty). */
export const readWhenMs = (): number => new Date(value('when')).getTime();

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
