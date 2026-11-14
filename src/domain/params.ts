import type { CoverDefinition } from './covers';
import type { AirflowId, BatId, ClayId, FeedbackKind, ShapeId, StageId, WetnessId } from './types';

/**
 * Every tunable number of the drying model in one place.
 * All values are starting assumptions; a fitted model can supply its own object.
 */
export interface ModelParams {
  /** g / (m² · h · hPa): still-air evaporation coefficient (calibrated guess) */
  evaporationCoefficient: number;
  /** g/cm³, wet clay */
  clayDensity: number;
  /** h, simulation step */
  stepHours: number;
  /** h, simulation horizon (beyond it a target counts as "never") */
  horizonHours: number;
  /** hPa, lower bound of the vapour pressure deficit */
  minVpd: number;
  /** relative humidity is clamped to this range inside the rate model */
  rhClamp: { min: number; max: number };
  /** night hours [from, to) when night conditions apply */
  night: { fromHour: number; toHour: number };
  /**
   * Built-in covers, from fastest to slowest drying. The list order is the canonical order
   * (bars, weight-check select, calibration table, two-phase ranking).
   */
  covers: readonly CoverDefinition[];
  /** air-movement multiplier near the shelf */
  airflowFactor: Record<AirflowId, number>;
  shapes: Record<ShapeId, { areaFactor: number; slowFactor: number }>;
  clays: Record<ClayId, { slowFactor: number; leatherHardLossPct: number }>;
  batSlowFactor: Record<BatId, number>;
  /** percentage points added to the target loss */
  wetnessOffsetPct: Record<WetnessId, number>;
  stageOffsetPct: Record<StageId, number>;
  /** exponent applied to base/wall thickness ratio */
  baseThicknessExponent: number;
  piece: { minMassG: number; minWallMm: number; minBaseMm: number };
  /** trimming window around the target, percentage points */
  window: { belowPct: number; abovePct: number };
  planner: {
    /** relative tolerance for a single cover to count as "on target" */
    targetTolerance: number;
    /** the damp room is suggested only for waits of at least this many hours (or stage "soft") */
    dampMinHours: number;
    bisectionSteps: number;
    /** two-phase plans with a shorter first phase are dropped */
    minFirstPhaseHours: number;
    /** a first phase longer than this makes it the plan's dominant cover */
    dominantFirstPhaseHours: number;
  };
  calibration: {
    /** pseudo-count shrinking the multiplier towards 1 with few samples */
    priorWeight: number;
    /** feedback this soon after throwing is ignored, h */
    minFeedbackHours: number;
    /** "too wet" means the right moment is later than now, "too dry" earlier */
    feedbackAdjust: Record<FeedbackKind, number>;
  };
  weightCheck: {
    /** h; after this the observed loss rate is trusted over the model */
    minObservedHours: number;
    /** % of mass; lower bound for the remaining-loss target in the model estimate */
    minRemainingPct: number;
  };
  tips: {
    /** hPa; above it the air counts as dry */
    dryAirVpd: number;
    /** airflow factor at or above which it counts as a draught */
    draughtAirflow: number;
    /** piece slowness above which the thick-base tip shows */
    slowPiece: number;
    /** h; longer waits show the mould tip */
    longWaitHours: number;
  };
}

export const DEFAULT_PARAMS: ModelParams = {
  evaporationCoefficient: 5.1,
  clayDensity: 1.9,
  stepHours: 0.25,
  horizonHours: 24 * 30,
  minVpd: 0.05,
  rhClamp: { min: 1, max: 99 },
  night: { fromHour: 22, toHour: 7 },
  covers: [
    { id: 'open', factor: 1, airflow: 'full', environment: 'room' },
    { id: 'partial', factor: 0.3, airflow: 'damped', environment: 'room' },
    { id: 'damp', factor: 0.6, airflow: 'none', environment: 'dampRoom', gate: 'longWaitOrSoft' },
    { id: 'full', factor: 0.07, airflow: 'none', environment: 'room' },
    { id: 'box', factor: 0.05, airflow: 'none', environment: 'room' },
  ],
  airflowFactor: { still: 1, light: 1.6, draft: 2.6 },
  shapes: {
    cyl: { areaFactor: 1.6, slowFactor: 1.0 },
    bowl: { areaFactor: 1.7, slowFactor: 0.95 },
    plate: { areaFactor: 1.0, slowFactor: 0.9 },
    vase: { areaFactor: 1.3, slowFactor: 1.15 },
    closed: { areaFactor: 1.0, slowFactor: 1.3 },
  },
  clays: {
    grog: { slowFactor: 0.9, leatherHardLossPct: 5.5 },
    stone: { slowFactor: 1.0, leatherHardLossPct: 6 },
    porc: { slowFactor: 1.25, leatherHardLossPct: 6.5 },
    earth: { slowFactor: 0.95, leatherHardLossPct: 6 },
  },
  batSlowFactor: { plastic: 1.1, wood: 1.0, plaster: 0.8 },
  wetnessOffsetPct: { dry: -1, normal: 0, wet: 1.5 },
  stageOffsetPct: { soft: -1, trim: 0, hard: 2 },
  baseThicknessExponent: 0.6,
  piece: { minMassG: 20, minWallMm: 2, minBaseMm: 2 },
  window: { belowPct: 1, abovePct: 1.5 },
  planner: {
    targetTolerance: 0.12,
    dampMinHours: 24 * 4,
    bisectionSteps: 28,
    minFirstPhaseHours: 0.5,
    dominantFirstPhaseHours: 12,
  },
  calibration: {
    priorWeight: 2,
    minFeedbackHours: 0.25,
    feedbackAdjust: { wet: 1.2, ok: 1, dry: 0.8 },
  },
  weightCheck: { minObservedHours: 0.5, minRemainingPct: 0.01 },
  tips: { dryAirVpd: 13, draughtAirflow: 2.6, slowPiece: 1.45, longWaitHours: 24 * 6 },
};

export const MS_PER_HOUR = 3.6e6;
