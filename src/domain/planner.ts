import type { CoverId } from './covers';
import { type DryingContext, hoursToLoss } from './simulate';
import type { Plan, StageId } from './types';

export type PlanOption =
  | { kind: 'single'; cover: CoverId; plan: Plan; hours: number }
  | { kind: 'twoPhase'; first: CoverId; then: CoverId; switchAfterHours: number; plan: Plan; hours: number };

export type Recommendation =
  /** the trim date is not after the throwing date */
  | { status: 'invalidDeadline' }
  | { status: 'onTarget'; option: PlanOption }
  /** even the fastest allowed cover (normally "open") is too slow; falls back to it */
  | { status: 'tooFast'; option: PlanOption; fastestHours: number }
  /** even the slowest allowed cover (normally "box") gets there too early; falls back to it */
  | { status: 'tooSlow'; option: PlanOption; slowestHours: number };

export interface PlanResult {
  /** hours from throwing to the wanted trim time (NaN/≤0 when invalid) */
  deadlineHours: number;
  /** hours to the target loss under each single cover, in catalog order */
  singles: Record<CoverId, number>;
  recommendation: Recommendation;
  /** up to three other plans that also meet the deadline */
  alternatives: PlanOption[];
  /** the allowed covers miss the deadline, but planning with every cover would meet it */
  excludedWouldMeet: boolean;
}

export interface PlanOptions {
  /** covers the planner may use; omitted or empty = all covers */
  allowed?: readonly CoverId[];
}

const single = (cover: CoverId, hours: number): PlanOption => ({
  kind: 'single',
  cover,
  plan: [{ cover, hours: Infinity }],
  hours,
});

/** The cover that best describes a plan (used to attribute calibration feedback). */
export function dominantCover(plan: Plan, dominantFirstPhaseHours: number): CoverId {
  if (plan.length === 1) return plan[0]!.cover;
  return plan[0]!.hours > dominantFirstPhaseHours ? plan[0]!.cover : plan[1]!.cover;
}

/**
 * What to recommend when no plan meets the deadline `H`. With nothing excluded: the first / last
 * catalog cover (normally "open" / "box"), with times over every cover. With exclusions: the
 * fastest / slowest candidate by hours; ties go to the earlier one in catalog order.
 */
function fallback(
  H: number,
  hours: (c: CoverId) => number,
  ids: readonly CoverId[],
  candidates: readonly CoverId[],
  filtered: boolean,
): Recommendation {
  if (!filtered) {
    const all = ids.map(hours);
    const fastest = Math.min(...all);
    const last = ids[ids.length - 1]!;
    return H < fastest
      ? { status: 'tooFast', fastestHours: fastest, option: single(ids[0]!, fastest) }
      : { status: 'tooSlow', slowestHours: Math.max(...all), option: single(last, hours(last)) };
  }
  const fastest = candidates.reduce((p, c) => (hours(c) < hours(p) ? c : p));
  const slowest = candidates.reduce((p, c) => (hours(c) > hours(p) ? c : p));
  return H < hours(fastest)
    ? { status: 'tooFast', fastestHours: hours(fastest), option: single(fastest, hours(fastest)) }
    : { status: 'tooSlow', slowestHours: hours(slowest), option: single(slowest, hours(slowest)) };
}

/** Finds how to cover the piece so it reaches its target loss at `deadlineHours` after throwing. */
export function planDrying(ctx: DryingContext, deadlineHours: number, stage: StageId, options: PlanOptions = {}): PlanResult {
  const H = deadlineHours;
  const cfg = ctx.params.planner;
  const target = ctx.piece.lossPct;
  const ids = ctx.covers.map((c) => c.id);
  const { allowed } = options;
  const allowedSet = allowed?.length ? ctx.covers.filter((c) => allowed.includes(c.id)) : ctx.covers;
  const filtered = allowedSet.length < ctx.covers.length;

  // every cover, also the excluded ones, so the bars can compare them all
  const singles = {} as Record<CoverId, number>;
  for (const c of ids) singles[c] = hoursToLoss([{ cover: c, hours: Infinity }], ctx, target);
  const hours = (c: CoverId): number => singles[c]!;

  if (!(H > 0)) {
    return { deadlineHours: H, singles, recommendation: { status: 'invalidDeadline' }, alternatives: [], excludedWouldMeet: false };
  }

  // gated covers (the damp room is small) are suggested only for very wet work or long waits,
  // unless nothing else is allowed
  const openGate = stage === 'soft' || H >= cfg.dampMinHours;
  const gated = allowedSet.filter((c) => c.gate !== 'longWaitOrSoft' || openGate);
  const candidates = (gated.length ? gated : allowedSet).map((c) => c.id);

  const singleOptions = candidates.map((c) => single(c, hours(c))).filter((o) => Number.isFinite(o.hours));

  // two-phase: a faster cover first (rim firms up), then a slower one
  const twoPhase: Extract<PlanOption, { kind: 'twoPhase' }>[] = [];
  for (const a of candidates) {
    for (const b of candidates) {
      if (a === b) continue;
      if (!(hours(a) < H && hours(b) > H)) continue;
      let lo = 0;
      let hi = H;
      for (let i = 0; i < cfg.bisectionSteps; i++) {
        const mid = (lo + hi) / 2;
        const t = hoursToLoss(
          [
            { cover: a, hours: mid },
            { cover: b, hours: Infinity },
          ],
          ctx,
          target,
        );
        if (t > H) lo = mid;
        else hi = mid;
      }
      const x = (lo + hi) / 2;
      if (x < cfg.minFirstPhaseHours) continue;
      const plan: Plan = [
        { cover: a, hours: x },
        { cover: b, hours: Infinity },
      ];
      // biome-ignore lint/suspicious/noThenProperty: `then` is the second cover of a plan, not a thenable
      twoPhase.push({ kind: 'twoPhase', first: a, then: b, switchAfterHours: x, plan, hours: hoursToLoss(plan, ctx, target) });
    }
  }

  const close = singleOptions
    .filter((o) => Math.abs(o.hours - H) / H <= cfg.targetTolerance)
    .sort((p, q) => Math.abs(p.hours - H) - Math.abs(q.hours - H));
  // prefer: the first catalog cover (normally open) first, then the gentlest wrap that is slower than target
  const rank = (o: (typeof twoPhase)[number]): [number, number] => [o.first === ids[0] ? 0 : 1, ids.indexOf(o.then)];
  twoPhase.sort((p, q) => {
    const [p0, p1] = rank(p);
    const [q0, q1] = rank(q);
    return p0 - q0 || p1 - q1;
  });

  let recommendation: Recommendation;
  let chosen: PlanOption | undefined;
  if (close.length) {
    chosen = close[0]!;
    recommendation = { status: 'onTarget', option: chosen };
  } else if (twoPhase.length) {
    chosen = twoPhase[0]!;
    recommendation = { status: 'onTarget', option: chosen };
  } else {
    recommendation = fallback(H, hours, ids, candidates, filtered);
  }
  const alternatives = [...close, ...twoPhase].filter((o) => o !== chosen).slice(0, 3);
  const excludedWouldMeet =
    filtered && recommendation.status !== 'onTarget' && planDrying(ctx, H, stage).recommendation.status === 'onTarget';
  return { deadlineHours: H, singles, recommendation, alternatives, excludedWouldMeet };
}
