// The recommendation (or warning), the comparison bars, alternatives, tips and the save button.
import type { CoverCalibration } from '../../../domain/calibration';
import { type CoverId, coverById } from '../../../domain/covers';
import { MS_PER_HOUR } from '../../../domain/params';
import type { PlanResult } from '../../../domain/planner';
import type { TipId } from '../../../domain/tips';
import type { Piece } from '../../../domain/types';
import type { Messages } from '../../../i18n';
import type { AppContext } from '../../context';
import { byId, closest, esc } from '../../dom';
import { coverIcon, icon } from '../../icons';
import { animateNumbers, captureRects, playFrom } from '../../motion';
import { num } from '../../numbers';
import { coverLabel, planText, type View } from '../../render';
import { save } from '../pieces/pieces';

export const markup = '<section id="result"></section>';

/** Comparison chart scale: deadline × 1.6, or at least 48 h; the longest finite bar counts between 24 h and 10 days. */
const CHART = {
  deadlineHeadroom: 1.6,
  noDeadlineHours: 48,
  minFiniteHours: 24,
  maxFiniteHours: 24 * 10,
} as const;

interface ResultModel {
  piece: Piece;
  startMs: number;
  plan: PlanResult;
  /** working window (hours after throwing) — only for an on-target recommendation */
  window?: { start: number; end: number };
  tips: TipId[];
  calibration: Record<CoverId, CoverCalibration>;
  canSave: boolean;
  /** covers the user left ticked; the others get a muted "excluded" bar */
  allowed: readonly CoverId[];
}

/** The warning card ("Uwaga") in place of a recommendation. */
const warning = (m: Messages, text: string, extra = ''): string =>
  `<div class="rec err"><div class="k">${icon('warning')}${m.result.warning}</div><div class="big" data-anim-text="big">${esc(text)}</div>${extra}</div>`;

function renderResult(v: View, r: ResultModel): string {
  const { m, fmt } = v;
  const { piece, startMs: start, plan } = r;
  const rec = plan.recommendation;
  const H = plan.deadlineHours;
  let html = '';
  if (rec.status === 'onTarget' && r.window) {
    const { start: ws, end: we } = r.window;
    const ready = num(fmt, 'ready', {
      kind: 'dateTime',
      value: start + rec.option.hours * MS_PER_HOUR,
    });
    const loss = num(fmt, 'loss', { kind: 'decimal', value: piece.lossPct, digits: 1 });
    const grams = num(fmt, 'grams', { kind: 'int', value: (piece.mass * piece.lossPct) / 100 });
    const winEnd = Number.isFinite(we)
      ? num(fmt, 'win-end', { kind: 'dateTime', value: start + we * MS_PER_HOUR })
      : m.result.windowOpenEnd;
    html += `<div class="rec">
        <div class="k">${icon('target')}${m.result.recommendation}</div>
        <div class="big" data-anim-text="big">${esc(planText(v, rec.option, start))}</div>
        <div class="sub" data-anim-text="sub">${m.result.ready(ready, loss, grams)}</div>
        <div class="win" data-anim-text="win">${m.result.window(num(fmt, 'win-start', { kind: 'dateTime', value: start + ws * MS_PER_HOUR }), winEnd)}</div>
      </div>`;
  } else if (rec.status !== 'onTarget') {
    let err: string;
    if (rec.status === 'invalidDeadline') {
      err = m.errors.invalidDeadline;
    } else {
      // the fallback is always a single cover; the first / last catalog cover is the default one
      const cover = coverById(v.covers, rec.option.plan[0]!.cover);
      if (rec.status === 'tooFast') {
        const d = fmt.duration(rec.fastestHours);
        err =
          cover === v.covers[0]
            ? m.errors.tooFast(d)
            : m.errors.tooFastWith(d, coverLabel(m, cover));
      } else {
        const d = fmt.duration(rec.slowestHours);
        err =
          cover === v.covers[v.covers.length - 1]
            ? m.errors.tooSlow(d)
            : m.errors.tooSlowWith(d, coverLabel(m, cover));
      }
    }
    const extra = plan.excludedWouldMeet
      ? `<div class="extra">${esc(m.errors.excludedWouldMeet)}</div>`
      : '';
    html += warning(m, err, extra);
  }

  // comparison bars
  const finite = v.covers.map((c) => plan.singles[c.id]!).filter(Number.isFinite);
  const maxShown = Math.max(
    H > 0 ? H * CHART.deadlineHeadroom : CHART.noDeadlineHours,
    Math.min(Math.max(...finite, CHART.minFiniteHours), CHART.maxFiniteHours),
  );
  html += `<div class="card"><h2>${icon('chart')}${m.result.compareTitle}</h2><div class="bars">`;
  for (const c of v.covers) {
    const t = plan.singles[c.id]!;
    const pct = Math.min(100, ((Number.isFinite(t) ? t : maxShown) / maxShown) * 100);
    const off = !r.allowed.includes(c.id);
    const good =
      !off &&
      H > 0 &&
      Number.isFinite(t) &&
      Math.abs(t - H) / H <= v.params.planner.targetTolerance;
    const n = r.calibration[c.id]!.samples;
    html += `<div class="bar${off ? ' off' : ''}"><div>${coverIcon(c.id, 'ico')}${coverLabel(m, c)}${n ? ` <span class="muted">·${n}</span>` : ''}${off ? ` <span class="muted">· ${m.result.excludedBar}</span>` : ''}${c.environment === 'dampRoom' ? `<br><span class="muted note">${m.result.dampNote}</span>` : ''}</div>
        <div class="track"><div class="fill ${good ? 'good' : ''}" data-anim-key="fill-${c.id}" style="width:${pct}%"></div>${H > 0 ? `<div class="target" data-anim-key="target-${c.id}" style="left:${Math.min(100, (H / maxShown) * 100)}%"></div>` : ''}</div>
        <div class="t">${num(fmt, `bar-${c.id}`, { kind: 'duration', value: t, suffix: pct >= 100 && Number.isFinite(t) ? '+' : '' })}</div></div>`;
  }
  html += `</div><div class="legend">${m.result.legend(H > 0 ? num(fmt, 'deadline', { kind: 'duration', value: H }) : m.result.noDeadline)}</div>`;
  if (plan.alternatives.length) {
    html +=
      `<div class="muted alt-title">${m.result.alternatives}</div><ul class="alt">` +
      plan.alternatives.map((o) => `<li>${esc(planText(v, o, start))}</li>`).join('') +
      `</ul>`;
  }
  for (const tip of r.tips) html += `<div class="tip">${esc(m.tips[tip])}</div>`;
  if (r.canSave) {
    html += `<div class="actions"><button class="main" id="savebtn"><span class="lbl">${m.result.save}</span></button><span class="vh" role="status" id="savestatus"></span></div>`;
  }
  html += `</div>`;
  return html;
}

function show(v: View, html: string): void {
  const el = byId('result');
  const before = captureRects(el);
  el.innerHTML = html;
  playFrom(before, el);
  animateNumbers(el, v.fmt);
}

export function update(v: View, r: ResultModel): void {
  show(v, renderResult(v, r));
}

/** Only the request to fix the flagged fields: no bars and no save button. */
export function showInvalid(v: View): void {
  show(v, warning(v.m, v.m.errors.invalidInput));
}

/** How long the save button says "saved" before its label returns. */
const SAVED_MS = 1200;
let savedTimer: ReturnType<typeof setTimeout> | undefined;

/** "Saved" with a check on the button for a moment, announced through the status region next to it. */
function showSaved(m: Messages): void {
  const button = byId('savebtn');
  const status = byId('savestatus');
  button.classList.add('done');
  button.innerHTML = `${icon('saved')}<span class="lbl">${m.result.saved}</span>`;
  status.textContent = m.result.saved;
  clearTimeout(savedTimer);
  savedTimer = setTimeout(() => {
    // a recalculation in the meantime has already rendered a fresh button
    if (!button.isConnected) return;
    button.classList.remove('done');
    button.innerHTML = `<span class="lbl">${m.result.save}</span>`;
    status.textContent = '';
  }, SAVED_MS);
}

export function mount(root: HTMLElement, ctx: AppContext): void {
  root.querySelector('#result')!.addEventListener('click', (e) => {
    if (!closest(e, '#savebtn') || !ctx.saveable) return;
    save(ctx);
    showSaved(ctx.view.m);
  });
}
