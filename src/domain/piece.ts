import type { ModelParams } from './params';
import type { Piece, PieceInput } from './types';

/** Every intermediate of `derivePiece`, for the step-by-step explanation. */
export interface PieceBreakdown extends Piece {
  /** mm, after clamping */
  wall: number;
  /** mm, after clamping (the wall thickness when no base was given) */
  base: number;
  /** cm², one side of the clay "sheet" */
  sideArea: number;
  areaFactor: number;
  shapeSlow: number;
  claySlow: number;
  batSlow: number;
  /** base-thickness factor: max(1, base / wall) ^ exponent */
  thick: number;
  clayLossPct: number;
  wetnessPct: number;
  stagePct: number;
}

/** `derivePiece` with all its intermediate values. */
export function pieceBreakdown(input: PieceInput, p: ModelParams): PieceBreakdown {
  const shape = p.shapes[input.shape];
  const clay = p.clays[input.clay];
  const mass = Math.max(p.piece.minMassG, input.massG);
  const wall = Math.max(p.piece.minWallMm, input.wallMm);
  const base = Math.max(p.piece.minBaseMm, input.baseMm ?? wall);
  const sideArea = mass / p.clayDensity / (wall / 10); // cm², one side of the clay "sheet"
  const area = (sideArea * shape.areaFactor) / 1e4; // m² exposed
  const thick = Math.max(1, base / wall) ** p.baseThicknessExponent;
  const batSlow = p.batSlowFactor[input.bat];
  const slow = shape.slowFactor * clay.slowFactor * batSlow * thick;
  const wetnessPct = p.wetnessOffsetPct[input.wetness];
  const stagePct = p.stageOffsetPct[input.stage];
  const lossPct = clay.leatherHardLossPct + wetnessPct + stagePct;
  return {
    mass,
    area,
    slow,
    lossPct,
    softPct: lossPct - p.window.belowPct,
    hardPct: lossPct + p.window.abovePct,
    wall,
    base,
    sideArea,
    areaFactor: shape.areaFactor,
    shapeSlow: shape.slowFactor,
    claySlow: clay.slowFactor,
    batSlow,
    thick,
    clayLossPct: clay.leatherHardLossPct,
    wetnessPct,
    stagePct,
  };
}

/** Turns the user's description of a piece into its drying properties. */
export function derivePiece(input: PieceInput, p: ModelParams): Piece {
  const { mass, area, slow, lossPct, softPct, hardPct } = pieceBreakdown(input, p);
  return { mass, area, slow, lossPct, softPct, hardPct };
}
