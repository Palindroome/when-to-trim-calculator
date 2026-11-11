import { describe, expect, it } from 'vitest';
import { feedbackToSample, geometricMeanCalibrator } from './calibration';
import { DEFAULT_PARAMS, MS_PER_HOUR } from './params';
import { physicalRateModel, psat } from './physics';
import { derivePiece } from './piece';
import { dominantCover, type PlanResult, planDrying } from './planner';
import { hoursToLoss, simulate } from './simulate';
import { constantRateModel, DEFAULT_CONDITIONS, DEFAULT_INPUT, makeContext, START } from './testing';
import { tipsFor } from './tips';
import { COVERS, type Cover } from './types';
import { assessWeight } from './weight';

const P = DEFAULT_PARAMS;

describe('psat', () => {
  it('matches the Magnus formula', () => {
    expect(psat(0)).toBeCloseTo(6.112, 6);
    expect(psat(20)).toBeCloseTo(23.326, 3);
  });
});

describe('derivePiece', () => {
  it('derives area, slowness and loss targets for the default cylinder', () => {
    const p = derivePiece(DEFAULT_INPUT, P);
    expect(p.mass).toBe(500);
    expect(p.area).toBeCloseTo(((500 / 1.9 / 0.6) * 1.6) / 1e4, 12);
    expect(p.slow).toBeCloseTo(Math.pow(1.5, 0.6), 12);
    expect(p).toMatchObject({ lossPct: 6, softPct: 5, hardPct: 7.5 });
  });

  it('clamps mass, wall and base to their minimums', () => {
    const p = derivePiece({ ...DEFAULT_INPUT, massG: 5, wallMm: 1, baseMm: 0 }, P);
    expect(p.mass).toBe(20);
    expect(p.area).toBeCloseTo(((20 / 1.9 / 0.2) * 1.6) / 1e4, 12);
    expect(p.slow).toBe(1); // base 2 / wall 2
  });

  it('falls back to the wall thickness when the base is not given', () => {
    const p = derivePiece({ ...DEFAULT_INPUT, baseMm: undefined }, P);
    expect(p.slow).toBe(1);
  });

  it('ignores a base thinner than the wall', () => {
    expect(derivePiece({ ...DEFAULT_INPUT, baseMm: 3 }, P).slow).toBe(1);
  });

  it('adds clay, wetness and stage offsets to the target loss', () => {
    const p = derivePiece({ ...DEFAULT_INPUT, clay: 'porc', wetness: 'wet', stage: 'hard' }, P);
    expect(p.lossPct).toBe(6.5 + 1.5 + 2);
    expect(p.softPct).toBe(9);
    expect(p.hardPct).toBe(11.5);
  });

  it('multiplies shape, clay, bat and thickness slowness', () => {
    const p = derivePiece({ ...DEFAULT_INPUT, shape: 'closed', clay: 'porc', bat: 'plastic', baseMm: 6 }, P);
    expect(p.slow).toBeCloseTo(1.3 * 1.25 * 1.1, 12);
  });
});

describe('physical rate model', () => {
  const model = physicalRateModel(P);
  const piece = derivePiece(DEFAULT_INPUT, P);
  const ones = geometricMeanCalibrator([], P).multipliers();
  const at = (h: number) => new Date(2026, 2, 4, h, 0).getTime();

  it('open drying uses the airflow factor and vapour deficit', () => {
    const vpd = psat(20) * 0.5;
    expect(model.rate('open', at(12), piece, DEFAULT_CONDITIONS, ones)).toBeCloseTo((5.1 * piece.area * vpd * 1.6) / piece.slow, 12);
  });

  it('partial cover uses the square root of airflow, full cover none', () => {
    const open = model.rate('open', at(12), piece, DEFAULT_CONDITIONS, ones);
    expect(model.rate('partial', at(12), piece, DEFAULT_CONDITIONS, ones)).toBeCloseTo((open / 1.6) * Math.sqrt(1.6) * 0.3, 12);
    expect(model.rate('full', at(12), piece, DEFAULT_CONDITIONS, ones)).toBeCloseTo((open / 1.6) * 0.07, 12);
  });

  it('damp room uses its own conditions and no airflow', () => {
    const expected = (5.1 * piece.area * psat(15) * (1 - 0.88) * 0.6) / piece.slow;
    expect(model.rate('damp', at(12), piece, DEFAULT_CONDITIONS, ones)).toBeCloseTo(expected, 12);
  });

  it('switches to night conditions between 22:00 and 07:00 only when enabled', () => {
    const env = { ...DEFAULT_CONDITIONS, night: true };
    const day = model.rate('open', at(12), piece, env, ones);
    expect(model.rate('open', at(21), piece, env, ones)).toBe(day);
    expect(model.rate('open', at(22), piece, env, ones)).not.toBe(day);
    expect(model.rate('open', at(6), piece, env, ones)).not.toBe(day);
    expect(model.rate('open', at(7), piece, env, ones)).toBe(day);
    expect(model.rate('open', at(23), piece, DEFAULT_CONDITIONS, ones)).toBe(day);
  });

  it('clamps humidity and the deficit floor', () => {
    const saturated = model.rate('open', at(12), piece, { ...DEFAULT_CONDITIONS, rh: 120 }, ones);
    expect(saturated).toBeCloseTo((5.1 * piece.area * Math.max(0.05, psat(20) * 0.01) * 1.6) / piece.slow, 12);
    const dry0 = model.rate('open', at(12), piece, { ...DEFAULT_CONDITIONS, rh: 0 }, ones);
    const dry1 = model.rate('open', at(12), piece, { ...DEFAULT_CONDITIONS, rh: 1 }, ones);
    expect(dry0).toBe(dry1);
    const cold = model.rate('open', at(12), piece, { ...DEFAULT_CONDITIONS, temp: -40, rh: 99 }, ones);
    expect(cold).toBeCloseTo((5.1 * piece.area * 0.05 * 1.6) / piece.slow, 12);
  });

  it('divides by the calibration multiplier', () => {
    const base = model.rate('box', at(12), piece, DEFAULT_CONDITIONS, ones);
    expect(model.rate('box', at(12), piece, DEFAULT_CONDITIONS, { ...ones, box: 2 })).toBeCloseTo(base / 2, 12);
  });
});

describe('simulate', () => {
  // 500 g piece; 6% = 30 g
  it('interpolates the crossing time at constant rate', () => {
    const ctx = makeContext({ model: constantRateModel({ open: 3 }) });
    expect(hoursToLoss([{ cover: 'open', hours: Infinity }], ctx, 6)).toBeCloseTo(10, 9);
  });

  it('returns several targets in one run', () => {
    const ctx = makeContext({ model: constantRateModel({ open: 2 }) });
    const [a, b] = simulate([{ cover: 'open', hours: Infinity }], ctx, [5, 7.5]);
    expect(a).toBeCloseTo(12.5, 9);
    expect(b).toBeCloseTo(18.75, 9);
  });

  it('switches phases at the boundary', () => {
    const ctx = makeContext({ model: constantRateModel({ open: 4, box: 1 }) });
    // 4 h open = 16 g, remaining 14 g at 1 g/h = 14 h
    expect(
      hoursToLoss(
        [
          { cover: 'open', hours: 4 },
          { cover: 'box', hours: Infinity },
        ],
        ctx,
        6,
      ),
    ).toBeCloseTo(18, 9);
  });

  it('gives Infinity beyond the 30-day horizon', () => {
    const ctx = makeContext({ model: constantRateModel({ box: 0.01 }) });
    expect(hoursToLoss([{ cover: 'box', hours: Infinity }], ctx, 6)).toBe(Infinity);
  });
});

describe('planDrying', () => {
  it('default inputs, 49 h deadline: open first, then a full bag', () => {
    const ctx = makeContext();
    const r = planDrying(ctx, 49, 'trim');
    expect(r.recommendation.status).toBe('onTarget');
    if (r.recommendation.status !== 'onTarget') return;
    const o = r.recommendation.option;
    expect(o.kind).toBe('twoPhase');
    if (o.kind !== 'twoPhase') return;
    expect([o.first, o.then]).toEqual(['open', 'full']);
    expect(o.switchAfterHours).toBeCloseTo(3.5, 6);
    expect(o.hours).toBeCloseTo(48.988012, 5);
    expect(r.alternatives.map((a) => (a.kind === 'twoPhase' ? `${a.first}>${a.then}` : a.cover))).toEqual([
      'open>box',
      'partial>full',
      'partial>box',
    ]);
    // single-cover times
    expect(r.singles.open).toBeGreaterThan(5);
    expect(r.singles.open).toBeLessThan(6.5);
    expect(r.singles.box).toBeGreaterThan(24 * 7);
  });

  it('prefers a single cover within ±12% of the deadline', () => {
    const ctx = makeContext();
    const r = planDrying(ctx, 25, 'trim');
    expect(r.recommendation.status).toBe('onTarget');
    if (r.recommendation.status === 'onTarget') expect(r.recommendation.option).toMatchObject({ kind: 'single', cover: 'partial' });
  });

  it('flags a deadline that is not after throwing', () => {
    for (const h of [0, -5, NaN]) {
      const r = planDrying(makeContext(), h, 'trim');
      expect(r.recommendation).toEqual({ status: 'invalidDeadline' });
      expect(r.alternatives).toEqual([]);
    }
  });

  it('too fast: falls back to "open" at the fastest time', () => {
    const r = planDrying(makeContext(), 2, 'trim');
    expect(r.recommendation.status).toBe('tooFast');
    if (r.recommendation.status === 'tooFast') {
      expect(r.recommendation.fastestHours).toBe(r.singles.open);
      expect(r.recommendation.option).toMatchObject({ kind: 'single', cover: 'open', hours: r.singles.open });
    }
  });

  it('too slow: falls back to "box"', () => {
    const r = planDrying(makeContext(), 24 * 20, 'trim');
    expect(r.recommendation.status).toBe('tooSlow');
    if (r.recommendation.status === 'tooSlow') {
      expect(r.recommendation.slowestHours).toBe(r.singles.box);
      expect(r.recommendation.option).toMatchObject({ kind: 'single', cover: 'box' });
    }
  });

  it('offers the damp room only from 4 days or for the soft stage', () => {
    const ctx = makeContext();
    const uses = (r: ReturnType<typeof planDrying>) =>
      [r.recommendation, ...r.alternatives.map((option) => ({ option }))].some(
        (x) => 'option' in x && x.option.plan.some((s) => s.cover === 'damp'),
      );
    expect(uses(planDrying(ctx, 95.75, 'trim'))).toBe(false);
    expect(uses(planDrying(ctx, 96, 'trim'))).toBe(true);
    const soft = makeContext({ input: { stage: 'soft' } });
    expect(uses(planDrying(soft, 49, 'soft'))).toBe(true);
  });
});

describe('planDrying with allowed covers', () => {
  const ctx = makeContext();
  const all: Cover[] = [...COVERS];
  const except = (...out: Cover[]): Cover[] => all.filter((c) => !out.includes(c));
  /** every cover used by the recommendation and the alternatives */
  const used = (r: PlanResult): Cover[] => {
    const opts = [...('option' in r.recommendation ? [r.recommendation.option] : []), ...r.alternatives];
    return opts.flatMap((o) => o.plan.map((s) => s.cover));
  };

  it('no options, all covers or an empty list give the same result as before', () => {
    for (const [h, stage] of [
      [49, 'trim'],
      [25, 'trim'],
      [2, 'trim'],
      [24 * 20, 'trim'],
      [95.75, 'trim'],
      [96, 'trim'],
      [49, 'soft'],
    ] as const) {
      const base = planDrying(ctx, h, stage);
      expect(base.excludedWouldMeet).toBe(false);
      expect(planDrying(ctx, h, stage, { allowed: all })).toEqual(base);
      expect(planDrying(ctx, h, stage, { allowed: [] })).toEqual(base);
    }
  });

  it('excluding open at 49 h: open is never used, partial then full is recommended', () => {
    const r = planDrying(ctx, 49, 'trim', { allowed: except('open') });
    expect(used(r)).not.toContain('open');
    expect(r.recommendation.status).toBe('onTarget');
    if (r.recommendation.status !== 'onTarget') return;
    expect(r.recommendation.option).toMatchObject({ kind: 'twoPhase', first: 'partial', then: 'full' });
  });

  it('excluding open at 2 h: too fast, falls back to the loose bag', () => {
    const r = planDrying(ctx, 2, 'trim', { allowed: except('open') });
    expect(r.recommendation.status).toBe('tooFast');
    if (r.recommendation.status !== 'tooFast') return;
    expect(r.recommendation.option).toMatchObject({ kind: 'single', cover: 'partial', hours: r.singles.partial });
    expect(r.recommendation.fastestHours).toBe(r.singles.partial);
    expect(r.excludedWouldMeet).toBe(false);
  });

  it('excluding box and full at 20 days: too slow, falls back to the slowest allowed cover', () => {
    const allowed = except('box', 'full');
    const r = planDrying(ctx, 24 * 20, 'trim', { allowed });
    expect(r.recommendation.status).toBe('tooSlow');
    if (r.recommendation.status !== 'tooSlow') return;
    const slowest = Math.max(...allowed.map((c) => r.singles[c]));
    expect(r.recommendation.slowestHours).toBe(slowest);
    expect(r.recommendation.option.kind).toBe('single');
    if (r.recommendation.option.kind !== 'single') return;
    expect(allowed).toContain(r.recommendation.option.cover);
    expect(r.singles[r.recommendation.option.cover]).toBe(slowest);
  });

  it('one allowed cover: no alternatives, status depends on the deadline', () => {
    const only = { allowed: ['partial'] as Cover[] };
    const on = planDrying(ctx, 25, 'trim', only);
    expect(on.recommendation).toMatchObject({ status: 'onTarget', option: { kind: 'single', cover: 'partial' } });
    expect(on.alternatives).toEqual([]);
    const fast = planDrying(ctx, 2, 'trim', only);
    expect(fast.recommendation).toMatchObject({ status: 'tooFast', option: { cover: 'partial' } });
    expect(fast.alternatives).toEqual([]);
    const slow = planDrying(ctx, 24 * 20, 'trim', only);
    expect(slow.recommendation).toMatchObject({ status: 'tooSlow', option: { cover: 'partial' } });
    expect(slow.alternatives).toEqual([]);
  });

  it('only the damp room allowed: it is used even for a short wait', () => {
    const r = planDrying(ctx, 49, 'trim', { allowed: ['damp'] });
    expect(r.recommendation.status).not.toBe('invalidDeadline');
    expect(used(r)).toEqual(['damp']);
  });

  it('flags when an excluded cover would meet the deadline', () => {
    const r = planDrying(ctx, 49, 'trim', { allowed: ['box'] });
    expect(r.recommendation.status).toBe('tooFast');
    expect(r.excludedWouldMeet).toBe(true);
    expect(planDrying(ctx, 49, 'trim').excludedWouldMeet).toBe(false);
  });

  it('still times every cover for the bars', () => {
    const r = planDrying(ctx, 49, 'trim', { allowed: ['partial'] });
    expect(Object.keys(r.singles)).toEqual([...COVERS]);
    expect(r.singles).toEqual(planDrying(ctx, 49, 'trim').singles);
  });

  it('ignores unknown cover ids', () => {
    const r = planDrying(ctx, 49, 'trim', { allowed: ['paperBag', 'open', 'full'] as unknown as Cover[] });
    expect(used(r).every((c) => c === 'open' || c === 'full')).toBe(true);
  });
});

describe('dominantCover', () => {
  it('is the only cover of a single plan', () => {
    expect(dominantCover([{ cover: 'box', hours: Infinity }], 12)).toBe('box');
  });
  it('is the second cover unless the first phase is longer than 12 h', () => {
    const plan = (h: number) => [
      { cover: 'open' as const, hours: h },
      { cover: 'full' as const, hours: Infinity },
    ];
    expect(dominantCover(plan(3.5), 12)).toBe('full');
    expect(dominantCover(plan(12), 12)).toBe('full');
    expect(dominantCover(plan(12.5), 12)).toBe('open');
  });
});

describe('geometric-mean calibrator', () => {
  it('is neutral without samples', () => {
    const c = geometricMeanCalibrator([], P);
    expect(c.estimate('open')).toEqual({ multiplier: 1, samples: 0 });
    expect(c.multipliers()).toEqual({ open: 1, partial: 1, damp: 1, full: 1, box: 1 });
  });

  it('shrinks the geometric mean towards 1 with n/(n+2)', () => {
    const c = geometricMeanCalibrator(
      [
        { cover: 'full', value: 2 },
        { cover: 'full', value: 8 },
        { cover: 'box', value: 3 },
      ],
      P,
    );
    expect(c.estimate('full').multiplier).toBeCloseTo(Math.pow(4, 0.5), 12);
    expect(c.estimate('full').samples).toBe(2);
    expect(c.estimate('box').multiplier).toBeCloseTo(Math.pow(3, 1 / 3), 12);
    expect(c.estimate('open').samples).toBe(0);
  });

  it('ignores non-positive and non-finite samples', () => {
    const c = geometricMeanCalibrator(
      [
        { cover: 'open', value: 0 },
        { cover: 'open', value: -1 },
        { cover: 'open', value: Infinity },
        { cover: 'open', value: NaN },
      ],
      P,
    );
    expect(c.estimate('open')).toEqual({ multiplier: 1, samples: 0 });
  });

  it('learns new samples', () => {
    const c = geometricMeanCalibrator([], P);
    c.learn({ cover: 'damp', value: 8 });
    expect(c.estimate('damp').samples).toBe(1);
    expect(c.estimate('damp').multiplier).toBeCloseTo(2, 12); // 8^(1/3)
  });
});

describe('feedbackToSample', () => {
  const rec = { startMs: START, predictedHours: 50, multiplierUsed: 1.1 };
  it('ignores feedback within the first 15 minutes', () => {
    expect(feedbackToSample(rec, 'ok', START + 0.25 * MS_PER_HOUR, P)).toBeNull();
  });
  it('scales observed time by the feedback kind', () => {
    const now = START + 40 * MS_PER_HOUR;
    expect(feedbackToSample(rec, 'ok', now, P)!.value).toBeCloseTo((1.1 * 40) / 50, 12);
    expect(feedbackToSample(rec, 'wet', now, P)!.value).toBeCloseTo((1.1 * 48) / 50, 12);
    expect(feedbackToSample(rec, 'dry', now, P)).toEqual({ actualHours: 40, value: (1.1 * (40 * 0.8)) / 50 });
  });
});

describe('assessWeight', () => {
  const ctx = makeContext();
  const base = { thrownMassG: 500, cover: 'open' as const, nowMs: START };
  it('returns null for missing masses', () => {
    expect(assessWeight({ ...base, currentMassG: NaN }, ctx)).toBeNull();
    expect(assessWeight({ ...base, currentMassG: 0 }, ctx)).toBeNull();
    expect(assessWeight({ ...base, thrownMassG: 0, currentMassG: 480 }, ctx)).toBeNull();
  });
  it('classifies against the window (inclusive edges)', () => {
    expect(assessWeight({ ...base, currentMassG: 475 }, ctx)).toEqual({ state: 'ok', lossPct: 5 });
    expect(assessWeight({ ...base, currentMassG: 462.5 }, ctx)).toEqual({ state: 'ok', lossPct: 7.5 });
    expect(assessWeight({ ...base, currentMassG: 460 }, ctx)).toEqual({ state: 'dry', lossPct: 8 });
  });
  it('estimates the rest from the observed rate after 30 minutes', () => {
    const a = assessWeight({ ...base, currentMassG: 490, nowMs: START + 24 * MS_PER_HOUR }, ctx);
    expect(a).toMatchObject({ state: 'wet', estimate: { kind: 'observedRate' } });
    if (a?.state === 'wet' && a.estimate.kind === 'observedRate') {
      expect(a.estimate.gramsPerHour).toBeCloseTo(10 / 24, 12);
      expect(a.estimate.remainingHours).toBeCloseTo(20 / (10 / 24), 9);
    }
  });
  it('estimates the rest from the model right after throwing', () => {
    const a = assessWeight({ ...base, currentMassG: 500 }, ctx);
    expect(a?.state).toBe('wet');
    if (a?.state === 'wet') {
      expect(a.estimate.kind).toBe('model');
      expect(a.estimate.remainingHours).toBeCloseTo(hoursToLoss([{ cover: 'open', hours: Infinity }], ctx, 6), 9);
    }
  });
});

describe('tipsFor', () => {
  const piece = derivePiece(DEFAULT_INPUT, P);
  const openPlan = { kind: 'single' as const, cover: 'open' as const, plan: [{ cover: 'open' as const, hours: Infinity }], hours: 10 };
  const rec = { status: 'onTarget' as const, option: openPlan };
  it('dry air or draught only when the plan starts open', () => {
    expect(tipsFor(rec, piece, { ...DEFAULT_CONDITIONS, airflow: 'draft' }, P)).toEqual(['dryAirRim']);
    expect(tipsFor(rec, piece, { ...DEFAULT_CONDITIONS, temp: 26, rh: 30 }, P)).toEqual(['dryAirRim']);
    const boxed = {
      status: 'onTarget' as const,
      option: { ...openPlan, cover: 'box' as const, plan: [{ cover: 'box' as const, hours: Infinity }] },
    };
    expect(tipsFor(boxed, piece, { ...DEFAULT_CONDITIONS, airflow: 'draft' }, P)).toEqual([]);
  });
  it('uses unclamped humidity (RH > 100 never counts as dry)', () => {
    expect(tipsFor(rec, piece, { ...DEFAULT_CONDITIONS, rh: 120 }, P)).toEqual([]);
  });
  it('thick base and long waits', () => {
    const slow = derivePiece({ ...DEFAULT_INPUT, shape: 'closed' }, P);
    expect(tipsFor({ status: 'onTarget', option: { ...openPlan, hours: 145 } }, slow, DEFAULT_CONDITIONS, P)).toEqual([
      'thickBase',
      'mould',
    ]);
    expect(tipsFor({ status: 'invalidDeadline' }, slow, DEFAULT_CONDITIONS, P)).toEqual(['thickBase']);
  });
});
