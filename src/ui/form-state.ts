// Everything the user has entered, kept across a language switch (which re-renders the whole page).
import type { CoverDefinition, CoverId } from '../domain/covers';
import type { AppContext } from './context';
import { byId } from './dom';
import * as coverFilter from './features/covers/covers';
import * as datetime from './features/datetime/datetime';
import { readAllowedCovers } from './form';

export interface FormState {
  fields: { id: string; value: string; checked: boolean }[];
  dates: datetime.DateTimeState;
  /** ticked cover checkboxes */
  allowed: CoverId[];
}

export function captureForm(root: HTMLElement, covers: readonly CoverDefinition[]): FormState {
  return {
    fields: [...root.querySelectorAll<HTMLInputElement | HTMLSelectElement>('input[id],select')].map((e) => ({
      id: e.id,
      value: e.value,
      checked: e instanceof HTMLInputElement && e.checked,
    })),
    dates: datetime.capture(root),
    allowed: readAllowedCovers(covers),
  };
}

export function restoreForm(root: HTMLElement, ctx: AppContext, s: FormState): void {
  for (const f of s.fields) {
    const e = byId<HTMLInputElement | HTMLSelectElement>(f.id);
    e.value = f.value;
    if (e instanceof HTMLInputElement && e.type === 'checkbox') e.checked = f.checked;
  }
  datetime.restore(root, ctx, s.dates);
  coverFilter.restore(root, s.allowed);
}
