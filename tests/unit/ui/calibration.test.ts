import { describe, expect, it } from 'vitest';
import { type Calibrator, geometricMeanCalibrator } from '../../../src/domain/calibration';
import type { CoverId } from '../../../src/domain/covers';
import { DEFAULT_PARAMS } from '../../../src/domain/params';
import { perCoverCalibration } from '../../../src/ui/calibration';

const IDS: CoverId[] = DEFAULT_PARAMS.covers.map((c) => c.id);

describe('perCoverCalibration', () => {
  it('has one entry per cover, each the calibrator estimate for that cover', () => {
    const cal = geometricMeanCalibrator(
      [
        { cover: 'open', value: 1.5 },
        { cover: 'open', value: 1.2 },
        { cover: 'full', value: 0.8 },
      ],
      DEFAULT_PARAMS,
    );
    const out = perCoverCalibration(cal, IDS);
    expect(Object.keys(out)).toEqual(IDS);
    for (const id of IDS) expect(out[id]).toEqual(cal.estimate(id));
    expect(out.open.samples).toBe(2);
    expect(out.full.samples).toBe(1);
    expect(out.partial).toEqual({ multiplier: 1, samples: 0 });
  });

  it('asks the calibrator only for the given covers', () => {
    const asked: CoverId[] = [];
    const cal: Calibrator = {
      estimate: (cover) => {
        asked.push(cover);
        return { multiplier: 2, samples: 3 };
      },
      multipliers: () => ({}),
      learn: () => {},
    };
    expect(perCoverCalibration(cal, ['damp', 'box'])).toEqual({ damp: { multiplier: 2, samples: 3 }, box: { multiplier: 2, samples: 3 } });
    expect(asked).toEqual(['damp', 'box']);
  });
});
