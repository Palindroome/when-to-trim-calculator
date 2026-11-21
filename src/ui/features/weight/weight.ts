// Section 4 "Sprawdź wagą": the mass now against the trimming window, and the time still to wait.
import { derivePiece } from '../../../domain/piece';
import { assessWeight, type WeightAssessment } from '../../../domain/weight';
import type { Messages } from '../../../i18n';
import type { AppContext } from '../../context';
import { byId, esc } from '../../dom';
import { readPieceInput, readThrownMs, readWeightInputs } from '../../form';
import { icon } from '../../icons';
import { reveal } from '../../motion';
import { type CatalogCover, coverLabel, type View } from '../../render';
import { mountSteppers, numberField } from '../../stepper';

const coverOptions = (m: Messages, covers: readonly CatalogCover[]): string =>
  covers.map((c) => `<option value="${c.id}">${esc(coverLabel(m, c))}</option>`).join('');

export function markup(m: Messages, covers: readonly CatalogCover[]): string {
  const f = m.fields;
  return `<section class="card">
    <h2><span class="n">4</span>${icon('scale')}${m.sections.weight}</h2>
    <p class="muted hint">${m.weightHint}</p>
    <div class="grid">
      <div><label for="mnow">${f.massNow}</label>${numberField(m, 'mnow', f.massNow, m.units.grams, `placeholder="${f.massNowPlaceholder}"`)}</div>
      <div><label for="wnow">${f.coverSoFar}</label>
        <select id="wnow">${coverOptions(m, covers)}</select></div>
    </div>
    <div id="wout"></div>
  </section>`;
}

function renderWeight(v: View, a: WeightAssessment | null): string {
  if (!a) return '';
  const { m, fmt } = v;
  const loss = fmt.decimal(a.lossPct, 1);
  let msg: string;
  if (a.state === 'wet') {
    const e = a.estimate;
    const est =
      e.kind === 'observedRate'
        ? m.weight.observedRate(fmt.decimal(e.gramsPerHour, 1), fmt.duration(e.remainingHours))
        : m.weight.modelEstimate(fmt.duration(e.remainingHours));
    msg = m.weight.tooSoft(loss, est);
  } else if (a.state === 'ok') {
    msg = m.weight.inWindow(loss);
  } else {
    msg = m.weight.tooHard(loss);
  }
  return `<div class="state ${a.state}">${esc(msg)}</div>`;
}

/** Re-renders the weight check; empty while the mass now or the thrown mass is missing, or a field is `invalid`. */
export function update(ctx: AppContext, invalid: boolean): void {
  const w = readWeightInputs();
  const out = byId('wout');
  if (invalid || !(w.currentMassG > 0) || !(w.thrownMassG > 0)) {
    out.innerHTML = '';
    return;
  }
  const piece = derivePiece(readPieceInput(), ctx.view.params);
  const t = ctx.now();
  const before = out.firstElementChild?.className;
  out.innerHTML = renderWeight(
    ctx.view,
    assessWeight({ ...w, nowMs: t }, ctx.context(piece, readThrownMs(t))),
  );
  // a new state (too soft / in the window / too hard) fades in
  const state = out.firstElementChild as HTMLElement | null;
  if (before && state && state.className !== before) reveal(state);
}

/** Rebuilds the "cover so far" select after the catalog changed, keeping the choice while it exists. */
export function refreshCovers(m: Messages, covers: readonly CatalogCover[]): void {
  const select = byId<HTMLSelectElement>('wnow');
  const chosen = select.value;
  select.innerHTML = coverOptions(m, covers);
  if (covers.some((c) => c.id === chosen)) select.value = chosen;
}

export function mount(root: HTMLElement, ctx: AppContext): void {
  // the mass and cover so far feed only the weight check, but an invalid mass now also blocks the recommendation
  const section = root.querySelector('#wout')!.closest('section')!;
  section.addEventListener('input', () => ctx.compute());
  mountSteppers(section, ctx.view.m);
}
