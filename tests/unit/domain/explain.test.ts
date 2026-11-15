import { describe, expect, it } from 'vitest';
import { coverById } from '../../../src/domain/covers';
import { explainCalculation } from '../../../src/domain/explain';
import { DEFAULT_PARAMS } from '../../../src/domain/params';
import { physicalRateModel, psat } from '../../../src/domain/physics';
import { derivePiece } from '../../../src/domain/piece';
import { planDrying } from '../../../src/domain/planner';
import { simulate } from '../../../src/domain/simulate';
import type { Conditions, PieceInput } from '../../../src/domain/types';
import { constantRateModel, DEFAULT_INPUT, makeContext, START } from './testing';

const P = DEFAULT_PARAMS;

function trace(
  deadlineHours: number | ((singles: Record<string, number>) => number),
  over: { input?: Partial<PieceInput>; conditions?: Partial<Conditions>; startMs?: number } = {},
) {
  const input = { ...DEFAULT_INPUT, ...over.input };
  const ctx = makeContext({ ...over, input });
  const H =
    typeof deadlineHours === 'number'
      ? deadlineHours
      : deadlineHours(planDrying(ctx, 1, input.stage).singles);
  const plan = planDrying(ctx, H, input.stage);
  return { ctx, plan, t: explainCalculation(input, ctx, plan) };
}

describe('explainCalculation', () => {
  it('repeats derivePiece, the rate model and the planner exactly (default piece, on target)', () => {
    const { ctx, plan, t } = trace((s) => s.open!);
    expect(t.piece).toMatchObject(derivePiece(DEFAULT_INPUT, P));
    expect(t.piece).toMatchObject({ wall: 6, base: 9, areaFactor: 1.6, clayLossPct: 6 });
    expect(t.piece.thick).toBeCloseTo(1.5 ** 0.6, 12);
    expect(t.piece.shapeSlow * t.piece.claySlow * t.piece.batSlow * t.piece.thick).toBe(
      t.piece.slow,
    );
    expect(t.grams).toEqual({ target: 30, soft: 25, hard: 37.5 });
    expect(t.physical).toBe(true);
    const model = physicalRateModel(P);
    for (const c of t.covers) {
      const def = coverById(P.covers, c.cover);
      expect(c.rate).toBe(model.rate(def, START, ctx.piece, ctx.conditions, ctx.multipliers));
      expect(c.hours).toBe(plan.singles[c.cover]);
      expect(c.multiplier).toBe(1);
      expect(c.factor).toBe(def.factor);
      const vpd = def.environment === 'dampRoom' ? t.air.damp.vpd : t.air.start.vpd;
      expect(
        (P.evaporationCoefficient * t.piece.area * vpd * c.air! * c.factor!) / t.piece.slow,
      ).toBeCloseTo(c.rate, 12);
      expect(c.nightRate).toBeUndefined();
    }
    expect(t.covers.map((c) => c.air)).toEqual([1.6, Math.sqrt(1.6), 1, 1, 1]);
    expect(t.air.start).toEqual({
      temp: 20,
      rh: 50,
      rhUsed: 50,
      psat: psat(20),
      vpd: psat(20) / 2,
    });
    expect(t.air.night).toBeUndefined();
    expect(t.air.damp.temp).toBe(15);
    expect(t.air.airflowFactor).toBe(1.6);
    expect(plan.recommendation).toMatchObject({ status: 'onTarget', option: { kind: 'single' } });
    expect(t.gateOpen).toBe(false);
    const rec = plan.recommendation;
    if (rec.status !== 'onTarget') throw new Error('expected on target');
    const [ws, we] = simulate(rec.option.plan, ctx, [t.piece.softPct, t.piece.hardPct]);
    expect(t.result).toEqual({ ready: rec.option.hours, windowStart: ws, windowEnd: we });
  });

  it('notes the clamps through the raw input', () => {
    const { t } = trace(24, { input: { massG: 5, wallMm: 1, baseMm: undefined } });
    expect(t.input).toMatchObject({ massG: 5, wallMm: 1, baseMm: undefined });
    expect(t.piece).toMatchObject({ mass: 20, wall: 2, base: 2 });
  });

  it('explains a two-phase plan', () => {
    const { t } = trace((s) => Math.sqrt(s.open! * s.partial!));
    const rec = t.plan.recommendation;
    if (rec.status !== 'onTarget' || rec.option.kind !== 'twoPhase')
      throw new Error('expected a two-phase plan');
    expect([rec.option.first, rec.option.then]).toEqual(['open', 'partial']);
    expect(t.result?.ready).toBeGreaterThan(0);
  });

  it('explains tooFast and tooSlow without a result', () => {
    const fast = trace((s) => s.open! / 3).t;
    expect(fast.plan.recommendation.status).toBe('tooFast');
    expect(fast.result).toBeUndefined();
    const slow = trace(700, { input: { massG: 20, wallMm: 2 } }).t;
    expect(slow.plan.recommendation.status).toBe('tooSlow');
    expect(slow.result).toBeUndefined();
    expect(slow.gateOpen).toBe(true);
  });

  it('keeps the steps up to the times for an invalid deadline', () => {
    const { plan, t } = trace(-5);
    expect(t.plan.recommendation.status).toBe('invalidDeadline');
    expect(t.gateOpen).toBeUndefined();
    expect(t.result).toBeUndefined();
    expect(t.covers.map((c) => c.hours)).toEqual(P.covers.map((c) => plan.singles[c.id]));
    expect(t.covers.every((c) => c.rate > 0)).toBe(true);
  });

  it('adds the night climate and night rates for studio covers only', () => {
    const { ctx, t } = trace(24, { conditions: { night: true } });
    expect(t.air.night).toMatchObject({ temp: 15, rh: 60 });
    // thrown at 9:00, so the start uses the day values
    expect(t.air.start.temp).toBe(20);
    const night = new Date(START);
    night.setHours(22, 0, 0, 0);
    const model = physicalRateModel(P);
    for (const c of t.covers) {
      const def = coverById(P.covers, c.cover);
      if (def.environment === 'dampRoom') expect(c.nightRate).toBeUndefined();
      else
        expect(c.nightRate).toBe(
          model.rate(def, night.getTime(), ctx.piece, ctx.conditions, ctx.multipliers),
        );
    }
  });

  it('marks the covers the user excluded and the ones the planner chose from', () => {
    const input = DEFAULT_INPUT;
    const ctx = makeContext();
    // default deadline: the damp room's gate is closed
    const all = explainCalculation(input, ctx, planDrying(ctx, 49, input.stage));
    expect(all.covers.map((c) => [c.cover, c.excluded, c.considered])).toEqual([
      ['open', false, true],
      ['partial', false, true],
      ['damp', false, false],
      ['full', false, true],
      ['box', false, true],
    ]);
    // only the damp room allowed: the planner falls back to it although its gate is closed
    const plan = planDrying(ctx, 49, input.stage, { allowed: ['damp'] });
    expect(plan.candidates).toEqual(['damp']);
    const t = explainCalculation(input, ctx, plan, ['damp']);
    expect(t.gateOpen).toBe(false);
    expect(t.covers.filter((c) => c.excluded).map((c) => c.cover)).toEqual([
      'open',
      'partial',
      'full',
      'box',
    ]);
    expect(t.covers.find((c) => c.cover === 'damp')).toMatchObject({
      excluded: false,
      considered: true,
    });
  });

  it('gives only the rates for a model that is not the physical one', () => {
    const input = DEFAULT_INPUT;
    const ctx = makeContext({ model: constantRateModel({ open: 10, partial: 3 }) });
    const plan = planDrying(ctx, 5, input.stage);
    const t = explainCalculation(input, ctx, plan);
    expect(t.physical).toBe(false);
    expect(t.covers[0]).toMatchObject({ cover: 'open', rate: 10 });
    expect(t.covers[0]!.air).toBeUndefined();
    expect(t.covers[0]!.factor).toBeUndefined();
  });
});
