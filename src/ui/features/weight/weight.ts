// Section 4 "Sprawdź wagą": the mass now against the trimming window, and the time still to wait.
import type { CoverDefinition } from '../../../domain/covers';
import { derivePiece } from '../../../domain/piece';
import { assessWeight, type WeightAssessment } from '../../../domain/weight';
import type { Messages } from '../../../i18n';
import type { AppContext } from '../../context';
import { byId, esc } from '../../dom';
import { readPieceInput, readThrownMs, readWeightInputs } from '../../form';
import { reveal } from '../../motion';
import { coverLabel, type View } from '../../render';

export function markup(m: Messages, covers: readonly CoverDefinition[]): string {
  const f = m.fields;
  return `<section class="card">
    <h2><span class="n">4</span>${m.sections.weight}</h2>
    <p class="muted hint">${m.weightHint}</p>
    <div class="grid">
      <div><label for="mnow">${f.massNow}</label><div class="unit"><input id="mnow" type="text" inputmode="decimal" autocomplete="off" placeholder="${f.massNowPlaceholder}"><span>${m.units.grams}</span></div></div>
      <div><label for="wnow">${f.coverSoFar}</label>
        <select id="wnow">${covers.map((c) => `<option value="${c.id}">${coverLabel(m, c)}</option>`).join('')}</select></div>
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

/** Re-renders the weight check; empty while the mass now or the thrown mass is missing. */
export function update(ctx: AppContext): void {
  const w = readWeightInputs();
  const out = byId('wout');
  if (!(w.currentMassG > 0) || !(w.thrownMassG > 0)) {
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

export function mount(root: HTMLElement, ctx: AppContext): void {
  // the mass and cover so far only feed the weight check, not the recommendation
  root
    .querySelector('#wout')!
    .closest('section')!
    .addEventListener('input', () => update(ctx));
}
