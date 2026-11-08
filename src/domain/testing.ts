// Shared fixtures for unit tests (not imported by the app).
import { geometricMeanCalibrator } from './calibration';
import { DEFAULT_PARAMS, type ModelParams } from './params';
import { physicalRateModel, type RateModel } from './physics';
import { derivePiece } from './piece';
import type { DryingContext } from './simulate';
import type { Conditions, PieceInput } from './types';

export const DEFAULT_INPUT: PieceInput = {
  massG: 500,
  shape: 'cyl',
  wallMm: 6,
  baseMm: 9,
  clay: 'stone',
  bat: 'wood',
  wetness: 'normal',
  stage: 'trim',
};

export const DEFAULT_CONDITIONS: Conditions = {
  temp: 20,
  rh: 50,
  airflow: 'light',
  night: false,
  nightTemp: 15,
  nightRh: 60,
  dampTemp: 15,
  dampRh: 88,
};

/** Wed 4 March 2026 09:00 local time. */
export const START = new Date(2026, 2, 4, 9, 0).getTime();

export function makeContext(
  over: {
    input?: Partial<PieceInput>;
    conditions?: Partial<Conditions>;
    params?: ModelParams;
    model?: RateModel;
    startMs?: number;
  } = {},
): DryingContext {
  const params = over.params ?? DEFAULT_PARAMS;
  return {
    piece: derivePiece({ ...DEFAULT_INPUT, ...over.input }, params),
    conditions: { ...DEFAULT_CONDITIONS, ...over.conditions },
    startMs: over.startMs ?? START,
    multipliers: geometricMeanCalibrator([], params).multipliers(),
    model: over.model ?? physicalRateModel(params),
    params,
  };
}

/** A rate model with a fixed g/h per cover, handy for checking the simulator arithmetic. */
export const constantRateModel = (gPerHour: Partial<Record<string, number>>): RateModel => ({
  rate: (cover) => gPerHour[cover] ?? 0,
});
