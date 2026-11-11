import type { ModelParams } from './params';
import type { Piece, PieceInput } from './types';

/** Turns the user's description of a piece into its drying properties. */
export function derivePiece(input: PieceInput, p: ModelParams): Piece {
  const shape = p.shapes[input.shape];
  const clay = p.clays[input.clay];
  const mass = Math.max(p.piece.minMassG, input.massG);
  const wall = Math.max(p.piece.minWallMm, input.wallMm);
  const base = Math.max(p.piece.minBaseMm, input.baseMm ?? wall);
  const sideArea = mass / p.clayDensity / (wall / 10); // cm², one side of the clay "sheet"
  const area = (sideArea * shape.areaFactor) / 1e4; // m² exposed
  const thick = Math.max(1, base / wall) ** p.baseThicknessExponent;
  const slow = shape.slowFactor * clay.slowFactor * p.batSlowFactor[input.bat] * thick;
  const lossPct = clay.leatherHardLossPct + p.wetnessOffsetPct[input.wetness] + p.stageOffsetPct[input.stage];
  return {
    mass,
    area,
    slow,
    lossPct,
    softPct: lossPct - p.window.belowPct,
    hardPct: lossPct + p.window.abovePct,
  };
}
