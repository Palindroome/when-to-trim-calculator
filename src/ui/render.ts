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
import type { IconName } from './icons';

/** A cover of the catalog: its definition, plus the name and icon of a user-defined cover. */
export interface CatalogCover extends CoverDefinition {
  /** user-entered (not HTML-escaped); built-in covers have none and read the i18n catalog */
  name?: string;
  icon?: IconName;
}

export interface View {
  m: Messages;
  fmt: Formatter;
  params: ModelParams;
  /** the cover catalog, in display order */
  covers: readonly CatalogCover[];
}

/**
 * A cover's name in the bars, the calibration table and the cover selects: its own name, or for
 * built-in covers the i18n catalog. Plain text: escape it before inserting it into HTML.
 */
export const coverLabel = (m: Messages, def: CatalogCover): string =>
  def.name ?? m.covers.label[def.id as BuiltInCoverId];

/** A cover's phrase for the plan sentences (plain text, like `coverLabel`). */
export const coverPhrase = (m: Messages, def: CatalogCover): string =>
  def.name === undefined
    ? m.covers.phrase[def.id as BuiltInCoverId]
    : m.covers.customPhrase(def.name);

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
