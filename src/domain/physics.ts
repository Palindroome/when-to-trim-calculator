import type { ModelParams } from './params';
import type { Conditions, Cover, CoverMultipliers, Piece } from './types';

/** Saturation vapour pressure over water, hPa (Magnus formula). */
export const psat = (tempC: number): number => 6.112 * Math.exp((17.62 * tempC) / (243.12 + tempC));

/**
 * Drying-speed model: grams of water lost per hour for a piece under a cover at a moment in time.
 * The physical model below is the default; a model trained on studio data can implement the same
 * interface and be passed to the simulator/planner instead.
 */
export interface RateModel {
  rate(cover: Cover, timeMs: number, piece: Piece, conditions: Conditions, multipliers: CoverMultipliers): number;
}

/** Evaporation driven by the vapour-pressure deficit, airflow and exposed area. */
export function physicalRateModel(p: ModelParams): RateModel {
  return {
    rate(cover, timeMs, piece, env, multipliers) {
      let temp: number;
      let rh: number;
      let air: number;
      if (cover === 'damp') {
        temp = env.dampTemp;
        rh = env.dampRh;
        air = 1;
      } else {
        const hour = new Date(timeMs).getHours();
        const isNight = env.night && (hour >= p.night.fromHour || hour < p.night.toHour);
        temp = isNight ? env.nightTemp : env.temp;
        rh = isNight ? env.nightRh : env.rh;
        const airflow = p.airflowFactor[env.airflow];
        air = cover === 'open' ? airflow : cover === 'partial' ? Math.sqrt(airflow) : 1;
      }
      const clampedRh = Math.min(p.rhClamp.max, Math.max(p.rhClamp.min, rh));
      const vpd = Math.max(p.minVpd, psat(temp) * (1 - clampedRh / 100));
      return (
        (p.evaporationCoefficient * piece.area * vpd * air * p.coverFactor[cover]) /
        (piece.slow * multipliers[cover])
      );
    },
  };
}
