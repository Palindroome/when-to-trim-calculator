import type { Calibrator, CoverCalibration } from '../domain/calibration';
import type { CoverId } from '../domain/covers';

/** Calibration of each of `ids`, keyed by cover: the comparison bars and the calibration table read it. */
export function perCoverCalibration(
  calibrator: Calibrator,
  ids: readonly CoverId[],
): Record<CoverId, CoverCalibration> {
  const out = {} as Record<CoverId, CoverCalibration>;
  for (const id of ids) out[id] = calibrator.estimate(id);
  return out;
}
