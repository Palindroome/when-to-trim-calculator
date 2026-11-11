import { coverById, type CoverDefinition } from './covers';
import type { ModelParams } from './params';
import { psat } from './physics';
import type { Recommendation } from './planner';
import type { Conditions, Piece } from './types';

export type TipId = 'dryAirRim' | 'thickBase' | 'mould';

/** Practical warnings shown under the comparison bars, in display order. */
export function tipsFor(
  rec: Recommendation,
  piece: Piece,
  env: Conditions,
  p: ModelParams,
  covers: readonly CoverDefinition[],
): TipId[] {
  // note: uses the raw daytime humidity, without the clamp applied in the rate model
  const vpd = psat(env.temp) * (1 - env.rh / 100);
  const option = rec.status === 'invalidDeadline' ? undefined : rec.option;
  const tips: TipId[] = [];
  // the rim of a piece left in full airflow dries first
  const usesOpen = option !== undefined && coverById(covers, option.plan[0]!.cover).airflow === 'full';
  if (usesOpen && (vpd > p.tips.dryAirVpd || p.airflowFactor[env.airflow] >= p.tips.draughtAirflow)) tips.push('dryAirRim');
  if (piece.slow > p.tips.slowPiece) tips.push('thickBase');
  if (option !== undefined && option.hours > p.tips.longWaitHours) tips.push('mould');
  return tips;
}
