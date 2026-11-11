import { MS_PER_HOUR } from './params';
import { type DryingContext, hoursToLoss } from './simulate';
import type { Cover } from './types';

export type WeightAssessment =
  | {
      state: 'wet';
      lossPct: number;
      estimate: { kind: 'observedRate'; gramsPerHour: number; remainingHours: number } | { kind: 'model'; remainingHours: number };
    }
  | { state: 'ok'; lossPct: number }
  | { state: 'dry'; lossPct: number };

export interface WeightCheckInput {
  /** mass right after throwing as typed (not clamped), g */
  thrownMassG: number;
  /** mass now, g */
  currentMassG: number;
  /** cover used since throwing (for the model estimate) */
  cover: Cover;
  /** epoch ms "now" */
  nowMs: number;
}

/**
 * Compares the measured mass loss with the trimming window. `ctx.startMs` is the throwing time.
 * Returns `null` when either mass is missing / not positive.
 */
export function assessWeight(input: WeightCheckInput, ctx: DryingContext): WeightAssessment | null {
  const m0 = input.thrownMassG;
  const m = input.currentMassG;
  if (!(m > 0) || !(m0 > 0)) return null;
  const { piece, params } = ctx;
  const elapsed = (input.nowMs - ctx.startMs) / MS_PER_HOUR;
  const lossPct = ((m0 - m) / m0) * 100;
  if (lossPct < piece.softPct) {
    const lostG = m0 - m;
    const need = (piece.mass * piece.lossPct) / 100 - lostG;
    if (elapsed > params.weightCheck.minObservedHours && lostG > 0) {
      const gramsPerHour = lostG / elapsed;
      return { state: 'wet', lossPct, estimate: { kind: 'observedRate', gramsPerHour, remainingHours: need / gramsPerHour } };
    }
    const remainingHours = hoursToLoss(
      [{ cover: input.cover, hours: Infinity }],
      { ...ctx, startMs: input.nowMs },
      Math.max(params.weightCheck.minRemainingPct, (need / piece.mass) * 100),
    );
    return { state: 'wet', lossPct, estimate: { kind: 'model', remainingHours } };
  }
  if (lossPct <= piece.hardPct) return { state: 'ok', lossPct };
  return { state: 'dry', lossPct };
}
