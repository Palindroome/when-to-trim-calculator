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
export function coverById(covers: readonly CoverDefinition[], id: CoverId): CoverDefinition {
  const def = covers.find((c) => c.id === id);
  if (!def) throw new Error(`unknown cover: ${id}`);
  return def;
}
