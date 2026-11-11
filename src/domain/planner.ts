import { hoursToLoss, type DryingContext } from './simulate';
import { COVERS, type Cover, type Plan, type StageId } from './types';

export type PlanOption =
  | { kind: 'single'; cover: Cover; plan: Plan; hours: number }
  | { kind: 'twoPhase'; first: Cover; then: Cover; switchAfterHours: number; plan: Plan; hours: number };

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
  /** hours to the target loss under each single cover, in COVERS order */
  singles: Record<Cover, number>;
  recommendation: Recommendation;
  /** up to three other plans that also meet the deadline */
  alternatives: PlanOption[];
  /** the allowed covers miss the deadline, but planning with every cover would meet it */
  excludedWouldMeet: boolean;
}

export interface PlanOptions {
  /** covers the planner may use; omitted or empty = all covers */
  allowed?: readonly Cover[];
}

const single = (cover: Cover, hours: number): PlanOption => ({
  kind: 'single',
  cover,
  plan: [{ cover, hours: Infinity }],
  hours,
});

/** The cover that best describes a plan (used to attribute calibration feedback). */
export function dominantCover(plan: Plan, dominantFirstPhaseHours: number): Cover {
  if (plan.length === 1) return plan[0]!.cover;
  return plan[0]!.hours > dominantFirstPhaseHours ? plan[0]!.cover : plan[1]!.cover;
}

/** Finds how to cover the piece so it reaches its target loss at `deadlineHours` after throwing. */
export function planDrying(ctx: DryingContext, deadlineHours: number, stage: StageId, options: PlanOptions = {}): PlanResult {
  const H = deadlineHours;
  const cfg = ctx.params.planner;
  const target = ctx.piece.lossPct;
  const { allowed } = options;
  const allowedSet = allowed?.length ? COVERS.filter((c) => allowed.includes(c)) : COVERS;
  const filtered = allowedSet.length < COVERS.length;

  // every cover, also the excluded ones, so the bars can compare them all
  const singles = {} as Record<Cover, number>;
  for (const c of COVERS) singles[c] = hoursToLoss([{ cover: c, hours: Infinity }], ctx, target);

  if (!(H > 0)) {
    return { deadlineHours: H, singles, recommendation: { status: 'invalidDeadline' }, alternatives: [], excludedWouldMeet: false };
  }

  // the damp room is small: suggest it only for very wet work or long waits,
  // unless it is the only cover allowed
  const allowDamp = stage === 'soft' || H >= cfg.dampMinHours;
  const gated = allowedSet.filter((c) => c !== 'damp' || allowDamp);
  const candidates = gated.length ? gated : allowedSet;

  const singleOptions = candidates.map((c) => single(c, singles[c])).filter((o) => isFinite(o.hours));

  // two-phase: a faster cover first (rim firms up), then a slower one
  const twoPhase: Extract<PlanOption, { kind: 'twoPhase' }>[] = [];
  for (const a of candidates) {
    for (const b of candidates) {
      if (a === b) continue;
      if (!(singles[a] < H && singles[b] > H)) continue;
      let lo = 0;
      let hi = H;
      for (let i = 0; i < cfg.bisectionSteps; i++) {
        const mid = (lo + hi) / 2;
        const t = hoursToLoss([{ cover: a, hours: mid }, { cover: b, hours: Infinity }], ctx, target);
        if (t > H) lo = mid;
        else hi = mid;
      }
      const x = (lo + hi) / 2;
      if (x < cfg.minFirstPhaseHours) continue;
      const plan: Plan = [{ cover: a, hours: x }, { cover: b, hours: Infinity }];
      twoPhase.push({ kind: 'twoPhase', first: a, then: b, switchAfterHours: x, plan, hours: hoursToLoss(plan, ctx, target) });
    }
  }

  const close = singleOptions
    .filter((o) => Math.abs(o.hours - H) / H <= cfg.targetTolerance)
    .sort((p, q) => Math.abs(p.hours - H) - Math.abs(q.hours - H));
  // prefer: open first, then the gentlest wrap that is slower than target
  const rank = (o: (typeof twoPhase)[number]): number => (o.first === 'open' ? 0 : 10) + COVERS.indexOf(o.then);
  twoPhase.sort((p, q) => rank(p) - rank(q));

  let recommendation: Recommendation;
  let chosen: PlanOption | undefined;
  if (close.length) {
    chosen = close[0]!;
    recommendation = { status: 'onTarget', option: chosen };
  } else if (twoPhase.length) {
    chosen = twoPhase[0]!;
    recommendation = { status: 'onTarget', option: chosen };
  } else if (!filtered) {
    // nothing excluded: the original fallbacks ("open" / "box", times over every cover)
    const all = COVERS.map((c) => singles[c]);
    const fastest = Math.min(...all);
    recommendation =
      H < fastest
        ? { status: 'tooFast', fastestHours: fastest, option: single('open', fastest) }
        : { status: 'tooSlow', slowestHours: Math.max(...all), option: single('box', singles.box) };
  } else {
    // fastest / slowest candidate by hours; ties go to the earlier one in COVERS order
    const fastest = candidates.reduce((p, c) => (singles[c] < singles[p] ? c : p));
    const slowest = candidates.reduce((p, c) => (singles[c] > singles[p] ? c : p));
    recommendation =
      H < singles[fastest]
        ? { status: 'tooFast', fastestHours: singles[fastest], option: single(fastest, singles[fastest]) }
        : { status: 'tooSlow', slowestHours: singles[slowest], option: single(slowest, singles[slowest]) };
  }
  const alternatives = [...close, ...twoPhase].filter((o) => o !== chosen).slice(0, 3);
  const excludedWouldMeet =
    filtered && recommendation.status !== 'onTarget' && planDrying(ctx, H, stage).recommendation.status === 'onTarget';
  return { deadlineHours: H, singles, recommendation, alternatives, excludedWouldMeet };
}
