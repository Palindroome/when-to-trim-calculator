import type { CoverId } from './covers';

export type ShapeId = 'cyl' | 'bowl' | 'plate' | 'vase' | 'closed';
export type ClayId = 'grog' | 'stone' | 'porc' | 'earth';
export type BatId = 'plastic' | 'wood' | 'plaster';
export type WetnessId = 'dry' | 'normal' | 'wet';
export type StageId = 'soft' | 'trim' | 'hard';
export type AirflowId = 'still' | 'light' | 'draft';
export type FeedbackKind = 'wet' | 'ok' | 'dry';

/** Display order of the choices. */
export const SHAPES: readonly ShapeId[] = ['cyl', 'bowl', 'plate', 'vase', 'closed'];
export const CLAYS: readonly ClayId[] = ['grog', 'stone', 'porc', 'earth'];
export const BATS: readonly BatId[] = ['plastic', 'wood', 'plaster'];
export const WETNESS: readonly WetnessId[] = ['dry', 'normal', 'wet'];
export const STAGES: readonly StageId[] = ['soft', 'trim', 'hard'];
export const AIRFLOWS: readonly AirflowId[] = ['still', 'light', 'draft'];
export const FEEDBACK_KINDS: readonly FeedbackKind[] = ['wet', 'ok', 'dry'];

/** Raw description of a freshly thrown piece, as entered by the user (numbers already parsed). */
export interface PieceInput {
  massG: number;
  shape: ShapeId;
  wallMm: number;
  /** `undefined` when not given: falls back to the wall thickness. */
  baseMm: number | undefined;
  clay: ClayId;
  bat: BatId;
  wetness: WetnessId;
  stage: StageId;
}

/** Derived drying properties of a piece. */
export interface Piece {
  /** g, clamped to the model minimum */
  mass: number;
  /** m² of exposed surface */
  area: number;
  /** combined slowness factor (1 = reference cylinder on wood) */
  slow: number;
  /** target mass loss for the chosen stage, % of thrown mass */
  lossPct: number;
  /** start of the working window, % */
  softPct: number;
  /** end of the working window, % */
  hardPct: number;
}

/** Room / storage conditions. Temperatures in °C, humidity in % RH. */
export interface Conditions {
  temp: number;
  rh: number;
  airflow: AirflowId;
  /** cooler nights (22–7) enabled */
  night: boolean;
  nightTemp: number;
  nightRh: number;
  dampTemp: number;
  dampRh: number;
}

/** One phase of a covering plan. `hours: Infinity` means "until done". */
export interface PlanStep {
  cover: CoverId;
  hours: number;
}
export type Plan = readonly PlanStep[];

/** Per-cover time multipliers applied to the physical model (1 = uncorrected; a missing entry means 1). */
export type CoverMultipliers = Readonly<Partial<Record<CoverId, number>>>;
