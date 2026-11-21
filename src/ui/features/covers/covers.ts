// Section 3 cover filter: the covering methods the planner may use.
import type { CoverId } from '../../../domain/covers';
import type { Messages } from '../../../i18n';
import type { AppContext } from '../../context';
import { byId, esc } from '../../dom';
import { coverIcon, icon } from '../../icons';
import { type CatalogCover, coverLabel } from '../../render';
import * as customCovers from '../custom-covers/custom-covers';

/**
 * Check (ticked) and cross (unticked) icons of a cover pill, drawn as a badge on the cover's icon;
 * CSS shows the one matching the checkbox.
 */
const PILL_ICONS = icon('pillOn', 'ico on') + icon('pillOff', 'ico off');

const pills = (m: Messages, covers: readonly CatalogCover[]): string =>
  covers
    .map(
      (c) =>
        `<label class="pill"><input type="checkbox" data-cover="${c.id}" checked><span class="face"><span class="mark">${coverIcon(c, 'cover-ico')}${PILL_ICONS}</span>${esc(coverLabel(m, c))}</span></label>`,
    )
    .join('\n        ');

export function markup(m: Messages, covers: readonly CatalogCover[]): string {
  return `<fieldset class="covers" id="covers">
      <legend>${m.covers.filterTitle}</legend>
      ${customCovers.jumpMarkup}
      <div class="opts">
        ${pills(m, covers)}
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

/**
 * Rebuilds the pills after the catalog changed: unticked covers stay unticked, a new cover is
 * ticked, and if nothing ticked is left (the only ticked cover was removed) every cover is ticked.
 */
export function refresh(root: HTMLElement, m: Messages, covers: readonly CatalogCover[]): void {
  const unticked = [...boxes(root)].filter((b) => !b.checked).map((b) => b.dataset.cover);
  root.querySelector('#covers .opts')!.innerHTML = pills(m, covers);
  const left = covers.map((c) => c.id).filter((id) => !unticked.includes(id));
  if (left.length) restore(root, left);
  sync(root);
}

export function mount(root: HTMLElement, ctx: AppContext): void {
  sync(root);
  byId('covers').addEventListener('input', () => {
    sync(root);
    ctx.compute();
  });
}
