// View helpers shared by several features: the current language and the wording of covers and plans.
import {
  type BuiltInCoverId,
  type CoverDefinition,
  type CoverId,
  coverById,
} from '../domain/covers';
import { type ModelParams, MS_PER_HOUR } from '../domain/params';
import type { PlanOption } from '../domain/planner';
import type { Formatter, Messages } from '../i18n';

export interface View {
  m: Messages;
  fmt: Formatter;
  params: ModelParams;
  /** the cover catalog, in display order */
  covers: readonly CoverDefinition[];
}

/** A cover's name in the bars, the calibration table and the cover selects. Built-in covers read the catalog. */
export const coverLabel = (m: Messages, def: CoverDefinition): string =>
  m.covers.label[def.id as BuiltInCoverId];

/** A cover's phrase for the plan sentences. Built-in covers read the catalog. */
export const coverPhrase = (m: Messages, def: CoverDefinition): string =>
  m.covers.phrase[def.id as BuiltInCoverId];

export function planText(v: View, o: PlanOption, startMs: number): string {
  const phrase = (id: CoverId): string => coverPhrase(v.m, coverById(v.covers, id));
  if (o.kind === 'single') return v.m.plan.single(phrase(o.cover));
  return v.m.plan.twoPhase(
    phrase(o.first),
    v.fmt.duration(o.switchAfterHours),
    v.fmt.dateTime(startMs + o.switchAfterHours * MS_PER_HOUR),
    phrase(o.then),
  );
}
