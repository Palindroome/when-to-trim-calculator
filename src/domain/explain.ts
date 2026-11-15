import type { CoverId } from './covers';
import { airFactor, type Climate, climate, isNightAt, isPhysicalRateModel } from './physics';
import { type PieceBreakdown, pieceBreakdown } from './piece';
import { gateOpen, type PlanResult } from './planner';
import { type DryingContext, simulate } from './simulate';
import type { AirflowId, PieceInput } from './types';

/** One cover in steps 6 and 7. */
export interface CoverTrace {
  cover: CoverId;
  /** air factor and cover factor; only for the physical model, whose rate splits into them */
  air?: number;
  factor?: number;
  /** calibration time multiplier (1 = uncorrected) */
  multiplier: number;
  /** g/h at the throwing time */
  rate: number;
  /** g/h at the first night hour from the throwing time; only for studio covers with night conditions on */
  nightRate?: number;
  /** hours to the target loss, as in `PlanResult.singles` */
  hours: number;
}

/**
 * Every number behind one recommendation, step by step: what the form says, the derived piece,
 * the air, the rate and time per cover, the plan and the result. Numbers and ids only.
 */
export interface CalculationTrace {
  /** the user's input, before the clamps */
  input: PieceInput;
  piece: PieceBreakdown;
  /** g of water to lose: to the target, the start and the end of the window */
  grams: { target: number; soft: number; hard: number };
  startMs: number;
  /** the studio at the throwing time, the studio at night (when on), the damp room */
  air: {
    start: Climate;
    night?: Climate;
    damp: Climate;
    airflow: AirflowId;
    airflowFactor: number;
  };
  /** false for a fitted rate model: step 6 then has only the rates */
  physical: boolean;
  covers: CoverTrace[];
  plan: PlanResult;
  /** whether covers gated 'longWaitOrSoft' were considered; undefined for an invalid deadline */
  gateOpen?: boolean;
  /** hours after throwing; only for an on-target plan */
  result?: { ready: number; windowStart: number; windowEnd: number };
}

/** First moment from `startMs` on at which the night conditions apply. */
function firstNightMs(ctx: DryingContext): number {
  const { startMs, conditions, params } = ctx;
  if (isNightAt(startMs, conditions, params)) return startMs;
  const d = new Date(startMs);
  d.setHours(params.night.fromHour, 0, 0, 0);
  return d.getTime();
}

/** Explains how `plan` (the planner's answer for `ctx`) follows from `input`. */
export function explainCalculation(
  input: PieceInput,
  ctx: DryingContext,
  plan: PlanResult,
): CalculationTrace {
  const { conditions: env, params: p, startMs, model, multipliers } = ctx;
  const piece = pieceBreakdown(input, p);
  const physical = isPhysicalRateModel(model);
  const grams = (pct: number): number => (piece.mass * pct) / 100;
  const nightMs = env.night ? firstNightMs(ctx) : undefined;

  const covers = ctx.covers.map((def): CoverTrace => {
    const rateAt = (ms: number): number => model.rate(def, ms, ctx.piece, env, multipliers);
    const c: CoverTrace = {
      cover: def.id,
      multiplier: multipliers[def.id] ?? 1,
      rate: rateAt(startMs),
      hours: plan.singles[def.id]!,
    };
    if (physical) {
      c.air = airFactor(def, env, p);
      c.factor = def.factor;
    }
    if (nightMs !== undefined && def.environment === 'room') c.nightRate = rateAt(nightMs);
    return c;
  });

  const rec = plan.recommendation;
  let result: CalculationTrace['result'];
  if (rec.status === 'onTarget') {
    const [ws, we] = simulate(rec.option.plan, ctx, [piece.softPct, piece.hardPct]) as [
      number,
      number,
    ];
    result = { ready: rec.option.hours, windowStart: ws, windowEnd: we };
  }

  return {
    input,
    piece,
    grams: { target: grams(piece.lossPct), soft: grams(piece.softPct), hard: grams(piece.hardPct) },
    startMs,
    air: {
      start: climate('room', isNightAt(startMs, env, p), env, p),
      night: env.night ? climate('room', true, env, p) : undefined,
      damp: climate('dampRoom', false, env, p),
      airflow: env.airflow,
      airflowFactor: p.airflowFactor[env.airflow],
    },
    physical,
    covers,
    plan,
    gateOpen: plan.deadlineHours > 0 ? gateOpen(input.stage, plan.deadlineHours, p) : undefined,
    result,
  };
}
