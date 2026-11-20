export type BuiltInCoverId = 'open' | 'partial' | 'damp' | 'full' | 'box';
/** Built-in ids, plus ids of user-defined covers. */
export type CoverId = BuiltInCoverId | `custom:${string}`;

/** One way of covering a drying piece, described as data for the rate model and the planner. */
export interface CoverDefinition {
  id: CoverId;
  /** fraction of open-air drying speed kept by the cover */
  factor: number;
  /** how the airflow factor reaches the piece: 'full' = airflow, 'damped' = sqrt(airflow), 'none' = 1 */
  airflow: 'full' | 'damped' | 'none';
  /** which conditions apply: the studio (with night mode) or the damp room (dampTemp/dampRh, airflow ignored) */
  environment: 'room' | 'dampRoom';
  /** planner gate: 'longWaitOrSoft' = only for stage "soft" or waits >= planner.dampMinHours */
  gate?: 'longWaitOrSoft';
}

/** The definition with this id; an unknown id is a programming error. */
export function coverById<T extends CoverDefinition>(covers: readonly T[], id: CoverId): T {
  const def = covers.find((c) => c.id === id);
  if (!def) throw new Error(`unknown cover: ${id}`);
  return def;
}

/** Presets offered for a user-defined cover's speed (values in `ModelParams.coverPresets`), in display order. */
export type CoverPresetId = 'slight' | 'likePartial' | 'likeDampCloth' | 'likeFull' | 'likeBox';
export const COVER_PRESETS: readonly CoverPresetId[] = [
  'slight',
  'likePartial',
  'likeDampCloth',
  'likeFull',
  'likeBox',
];

/**
 * The built-in catalog with user-defined covers inserted by factor, so the list still reads from
 * fastest to slowest: each one goes after the last studio (`room`) built-in at least as fast, ties
 * keep the order of `customs`. Built-ins keep their relative order (the damp room keeps its slot).
 */
export function withCustomCovers<T extends CoverDefinition>(
  builtIns: readonly T[],
  customs: readonly T[],
): readonly T[] {
  if (!customs.length) return builtIns;
  const anchor = (c: T): number => {
    let at = -1;
    builtIns.forEach((b, i) => {
      if (b.environment === 'room' && b.factor >= c.factor) at = i;
    });
    return at;
  };
  const sorted = [...customs].sort((a, b) => b.factor - a.factor);
  const after = (i: number): T[] => sorted.filter((c) => anchor(c) === i);
  return [...after(-1), ...builtIns.flatMap((b, i) => [b, ...after(i)])];
}
