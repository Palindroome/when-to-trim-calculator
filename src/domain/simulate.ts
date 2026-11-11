import { MS_PER_HOUR, type ModelParams } from './params';
import type { RateModel } from './physics';
import type { Conditions, CoverMultipliers, Piece, Plan } from './types';

/** Everything a drying simulation needs besides the plan itself. */
export interface DryingContext {
  piece: Piece;
  conditions: Conditions;
  /** epoch ms when the piece was thrown */
  startMs: number;
  multipliers: CoverMultipliers;
  model: RateModel;
  params: ModelParams;
}

/**
 * Steps the drying model through a plan (the last step lasts forever) and returns,
 * for each target mass loss (% of thrown mass, ascending), the hours after `startMs`
 * at which it is reached — `Infinity` if not within the simulation horizon.
 */
export function simulate(plan: Plan, ctx: DryingContext, targetsPct: readonly number[]): number[] {
  const { piece, conditions, startMs, multipliers, model, params } = ctx;
  const dt = params.stepHours;
  const targets = targetsPct.map((pct) => (piece.mass * pct) / 100);
  const out = targets.map(() => Infinity);
  let lost = 0;
  let t = 0;
  let seg = 0;
  let segEnd = plan[0]!.hours;
  let idx = 0;
  while (t < params.horizonHours && idx < targets.length) {
    while (t >= segEnd && seg < plan.length - 1) {
      seg++;
      segEnd += plan[seg]!.hours;
    }
    const r = model.rate(plan[seg]!.cover, startMs + t * MS_PER_HOUR, piece, conditions, multipliers);
    const next = lost + r * dt;
    while (idx < targets.length && next >= targets[idx]!) {
      out[idx] = t + (dt * (targets[idx]! - lost)) / Math.max(1e-9, next - lost);
      idx++;
    }
    lost = next;
    t += dt;
  }
  return out;
}

/** Hours to reach a single target loss. */
export const hoursToLoss = (plan: Plan, ctx: DryingContext, targetPct: number): number => simulate(plan, ctx, [targetPct])[0]!;
