import { MS_PER_HOUR, type ModelParams } from './params';
import { COVERS, type Cover, type CoverMultipliers, type FeedbackKind } from './types';

/**
 * One observation of how a prediction turned out: `value` is the time multiplier that would have
 * made the prediction right (> 1 = the piece dried slower than predicted).
 */
export interface CalibrationSample {
  cover: Cover;
  value: number;
}

export interface CoverCalibration {
  /** time multiplier applied on top of the physical model */
  multiplier: number;
  /** number of samples behind it */
  samples: number;
}

/**
 * Learns per-studio corrections from feedback. The default is a shrunk geometric mean per cover;
 * a trained model can implement the same interface.
 */
export interface Calibrator {
  estimate(cover: Cover): CoverCalibration;
  multipliers(): CoverMultipliers;
  learn(sample: CalibrationSample): void;
}

export type CalibratorFactory = (samples: readonly CalibrationSample[], params: ModelParams) => Calibrator;

/** Geometric mean of the samples, shrunk towards 1 while there are few of them. */
export const geometricMeanCalibrator: CalibratorFactory = (initial, params) => {
  const samples: CalibrationSample[] = [...initial];
  const estimate = (cover: Cover): CoverCalibration => {
    const values = samples.filter((s) => s.cover === cover).map((s) => s.value).filter((x) => x > 0 && isFinite(x));
    if (!values.length) return { multiplier: 1, samples: 0 };
    const g = Math.exp(values.reduce((a, x) => a + Math.log(x), 0) / values.length);
    const w = values.length / (values.length + params.calibration.priorWeight);
    return { multiplier: Math.exp(w * Math.log(g)), samples: values.length };
  };
  return {
    estimate,
    multipliers() {
      const m = {} as Record<Cover, number>;
      for (const c of COVERS) m[c] = estimate(c).multiplier;
      return m;
    },
    learn(sample) {
      samples.push(sample);
    },
  };
};

/** Prediction data needed to turn "trimming now, it is too wet / ok / too dry" into a sample. */
export interface PredictionRecord {
  startMs: number;
  predictedHours: number;
  /** calibration multiplier that was in effect for the dominant cover when predicting */
  multiplierUsed: number;
}

export interface FeedbackOutcome {
  actualHours: number;
  value: number;
}

/** Returns `null` when the feedback comes too early to be meaningful. */
export function feedbackToSample(
  rec: PredictionRecord,
  kind: FeedbackKind,
  nowMs: number,
  params: ModelParams,
): FeedbackOutcome | null {
  const actualHours = (nowMs - rec.startMs) / MS_PER_HOUR;
  if (actualHours <= params.calibration.minFeedbackHours) return null;
  const adj = params.calibration.feedbackAdjust[kind];
  return { actualHours, value: (rec.multiplierUsed * (actualHours * adj)) / rec.predictedHours };
}
