import type { CoverDefinition } from './covers';
import type { ModelParams } from './params';
import type { Conditions, CoverMultipliers, Piece } from './types';

/** Constants of the Magnus formula: psat(T) = a · exp(b · T / (c + T)), hPa and °C. */
export const MAGNUS = { a: 6.112, b: 17.62, c: 243.12 } as const;

/** Saturation vapour pressure over water, hPa (Magnus formula). */
export const psat = (tempC: number): number =>
  MAGNUS.a * Math.exp((MAGNUS.b * tempC) / (MAGNUS.c + tempC));

/**
 * Drying-speed model: grams of water lost per hour for a piece under a cover at a moment in time.
 * The physical model below is the default; a model trained on studio data can implement the same
 * interface and be passed to the simulator/planner instead.
 */
export interface RateModel {
  rate(
    cover: CoverDefinition,
    timeMs: number,
    piece: Piece,
    conditions: Conditions,
    multipliers: CoverMultipliers,
  ): number;
}

/** The air around a piece and how much more water vapour it can take. */
export interface Climate {
  /** °C */
  temp: number;
  /** % RH, as entered */
  rh: number;
  /** % RH, clamped to `rhClamp` */
  rhUsed: number;
  /** hPa, saturation vapour pressure at `temp` */
  psat: number;
  /** hPa, vapour pressure deficit, at least `minVpd` */
  vpd: number;
}

/** Whether this moment falls in the night hours `p.night` (local time), whether or not night mode is on. */
export const isNightHour = (timeMs: number, p: ModelParams): boolean => {
  const hour = new Date(timeMs).getHours();
  return hour >= p.night.fromHour || hour < p.night.toHour;
};

/** Whether the night conditions apply at this moment. */
export const isNightAt = (timeMs: number, env: Conditions, p: ModelParams): boolean =>
  env.night && isNightHour(timeMs, p);

/** The climate of a cover's environment: the damp room, or the studio by day or at night. */
export function climate(
  environment: CoverDefinition['environment'],
  night: boolean,
  env: Conditions,
  p: ModelParams,
): Climate {
  const damp = environment === 'dampRoom';
  const temp = damp ? env.dampTemp : night ? env.nightTemp : env.temp;
  const rh = damp ? env.dampRh : night ? env.nightRh : env.rh;
  const rhUsed = Math.min(p.rhClamp.max, Math.max(p.rhClamp.min, rh));
  const ps = psat(temp);
  return { temp, rh, rhUsed, psat: ps, vpd: Math.max(p.minVpd, ps * (1 - rhUsed / 100)) };
}

/** How much of the studio's airflow reaches a piece under this cover. */
export function airFactor(cover: CoverDefinition, env: Conditions, p: ModelParams): number {
  if (cover.environment === 'dampRoom') return 1;
  const airflow = p.airflowFactor[env.airflow];
  return cover.airflow === 'full' ? airflow : cover.airflow === 'damped' ? Math.sqrt(airflow) : 1;
}

const physicalModels = new WeakSet<RateModel>();

/** Whether `model` is a `physicalRateModel`, whose rate splits into the factors above. */
export const isPhysicalRateModel = (model: RateModel): boolean => physicalModels.has(model);

/** Evaporation driven by the vapour-pressure deficit, airflow and exposed area. */
export function physicalRateModel(p: ModelParams): RateModel {
  const model: RateModel = {
    rate(cover, timeMs, piece, env, multipliers) {
      const { vpd } = climate(cover.environment, isNightAt(timeMs, env, p), env, p);
      const air = airFactor(cover, env, p);
      return (
        (p.evaporationCoefficient * piece.area * vpd * air * cover.factor) /
        (piece.slow * (multipliers[cover.id] ?? 1))
      );
    },
  };
  physicalModels.add(model);
  return model;
}
