import { describe, expect, it } from 'vitest';
import {
  type CoverDefinition,
  type CoverId,
  coverById,
  withCustomCovers,
} from '../../../src/domain/covers';
import { DEFAULT_PARAMS as P } from '../../../src/domain/params';
import { physicalRateModel } from '../../../src/domain/physics';
import { planDrying } from '../../../src/domain/planner';
import { DEFAULT_CONDITIONS, makeContext, START } from './testing';

const custom = (
  id: string,
  factor: number,
  airflow: CoverDefinition['airflow'] = 'none',
): CoverDefinition => ({ id: `custom:${id}`, factor, airflow, environment: 'room' });
const ids = (covers: readonly CoverDefinition[]): CoverId[] => covers.map((c) => c.id);

describe('withCustomCovers', () => {
  it('returns the built-ins unchanged without custom covers', () => {
    expect(withCustomCovers(P.covers, [])).toBe(P.covers);
  });

  it('inserts each cover after the last studio built-in at least as fast; the damp room keeps its slot', () => {
    const covers = withCustomCovers(P.covers, [
      custom('cloth', 0.15),
      custom('paper', 0.6, 'damped'),
      custom('slowest', 0.01),
      custom('asFull', 0.07),
      custom('fast', 1),
    ]);
    expect(ids(covers)).toEqual([
      'open',
      'custom:fast',
      'custom:paper',
      'partial',
      'custom:cloth',
      'damp',
      'full',
      'custom:asFull',
      'box',
      'custom:slowest',
    ]);
  });

  it('orders custom covers by factor, descending; ties keep their order', () => {
    const covers = withCustomCovers(P.covers, [
      custom('b', 0.5),
      custom('a', 0.6),
      custom('c', 0.5),
    ]);
    expect(ids(covers).slice(0, 4)).toEqual(['open', 'custom:a', 'custom:b', 'custom:c']);
  });
});

describe('planning with custom covers', () => {
  it('can recommend a custom cover on its own', () => {
    const covers = withCustomCovers(P.covers, [custom('paper', 0.6, 'damped')]);
    const ctx = makeContext({ covers });
    const r = planDrying(ctx, 1, 'trim');
    const H = r.singles['custom:paper']!;
    expect(Number.isFinite(H)).toBe(true);
    const plan = planDrying(ctx, H, 'trim');
    expect(plan.recommendation).toMatchObject({
      status: 'onTarget',
      option: { kind: 'single', cover: 'custom:paper' },
    });
  });

  it('can use a custom cover in a two-phase plan', () => {
    // with the full bag and the box excluded, a slow custom cover is the only second phase
    const covers = withCustomCovers(P.covers, [custom('bucket', 0.06)]);
    const r = planDrying(makeContext({ covers }), 49, 'trim', {
      allowed: ['open', 'partial', 'custom:bucket'],
    });
    expect(r.recommendation).toMatchObject({
      status: 'onTarget',
      // biome-ignore lint/suspicious/noThenProperty: `then` is the second cover of a plan, not a thenable
      option: { kind: 'twoPhase', first: 'open', then: 'custom:bucket' },
    });
  });

  it('a custom cover slower than the box is the "too slow" fallback', () => {
    const covers = withCustomCovers(P.covers, [custom('slowest', 0.03)]);
    const r = planDrying(makeContext({ covers }), 24 * 29, 'trim');
    expect(Number.isFinite(r.singles['custom:slowest'])).toBe(true);
    expect(r.recommendation).toMatchObject({
      status: 'tooSlow',
      option: { cover: 'custom:slowest' },
    });
  });

  it('a damped custom cover gets the square root of the airflow factor', () => {
    const model = physicalRateModel(P);
    const piece = makeContext().piece;
    const damped = custom('paper', 0.6, 'damped');
    const none = custom('paper', 0.6, 'none');
    const at = START + 3 * 3.6e6;
    const ratio =
      model.rate(damped, at, piece, DEFAULT_CONDITIONS, {}) /
      model.rate(none, at, piece, DEFAULT_CONDITIONS, {});
    expect(ratio).toBeCloseTo(Math.sqrt(P.airflowFactor.light), 12);
  });

  it('coverById finds a custom cover in the merged catalog', () => {
    const covers = withCustomCovers(P.covers, [custom('paper', 0.6)]);
    expect(coverById(covers, 'custom:paper').factor).toBe(0.6);
  });
});
