// Section 3 cover filter: the covering methods the planner may use.
import type { CoverDefinition, CoverId } from '../../../domain/covers';
import type { Messages } from '../../../i18n';
import type { AppContext } from '../../context';
import { byId } from '../../dom';
import { coverIcon, icon } from '../../icons';
import { coverLabel } from '../../render';

/**
 * Check (ticked) and cross (unticked) icons of a cover pill, drawn as a badge on the cover's icon;
 * CSS shows the one matching the checkbox.
 */
const PILL_ICONS = icon('pillOn', 'ico on') + icon('pillOff', 'ico off');

export function markup(m: Messages, covers: readonly CoverDefinition[]): string {
  return `<fieldset class="covers" id="covers">
      <legend>${m.covers.filterTitle}</legend>
      <div class="opts">
        ${covers.map((c) => `<label class="pill"><input type="checkbox" data-cover="${c.id}" checked><span class="face"><span class="mark">${coverIcon(c.id, 'cover-ico')}${PILL_ICONS}</span>${coverLabel(m, c)}</span></label>`).join('\n        ')}
      </div>
      <p class="muted" id="covers-hint">${m.covers.filterHint}</p>
      <p class="muted hide" id="covers-last" aria-live="polite">${m.covers.filterLastOne}</p>
    </fieldset>`;
}

const boxes = (root: HTMLElement): NodeListOf<HTMLInputElement> =>
  root.querySelectorAll<HTMLInputElement>('input[data-cover]');

/** The last ticked cover cannot be unticked: disable it and show why. */
function sync(root: HTMLElement): void {
  const ticked = [...boxes(root)].filter((b) => b.checked);
  boxes(root).forEach((b) => {
    b.disabled = ticked.length === 1 && b.checked;
  });
  byId('covers-last').classList.toggle('hide', ticked.length !== 1);
}

/** Ticks exactly the `allowed` covers (after a language switch). */
export function restore(root: HTMLElement, allowed: readonly CoverId[]): void {
  boxes(root).forEach((b) => {
    b.checked = allowed.includes(b.dataset.cover as CoverId);
  });
}

export function mount(root: HTMLElement, ctx: AppContext): void {
  sync(root);
  byId('covers').addEventListener('input', () => {
    sync(root);
    ctx.compute();
  });
}
