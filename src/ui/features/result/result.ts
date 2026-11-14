// The recommendation (or warning), the comparison bars, alternatives, tips and the save button.
import type { CoverCalibration } from '../../../domain/calibration';
import { type CoverId, coverById } from '../../../domain/covers';
import { MS_PER_HOUR } from '../../../domain/params';
import type { PlanResult } from '../../../domain/planner';
import type { TipId } from '../../../domain/tips';
import type { Piece } from '../../../domain/types';
import type { AppContext } from '../../context';
import { byId, closest, esc } from '../../dom';
import { coverLabel, planText, type View } from '../../render';
import { save } from '../pieces/pieces';

export const markup = '<section id="result"></section>';

/** Comparison chart scale: deadline × 1.6, or at least 48 h; the longest finite bar counts between 24 h and 10 days. */
const CHART = { deadlineHeadroom: 1.6, noDeadlineHours: 48, minFiniteHours: 24, maxFiniteHours: 24 * 10 } as const;

export interface ResultModel {
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

export function renderResult(v: View, r: ResultModel): string {
  const { m, fmt } = v;
  const { piece, startMs: start, plan } = r;
  const rec = plan.recommendation;
  const H = plan.deadlineHours;
  let html = '';
  if (rec.status === 'onTarget' && r.window) {
    const { start: ws, end: we } = r.window;
    html += `<div class="rec">
        <div class="k">${m.result.recommendation}</div>
        <div class="big">${esc(planText(v, rec.option, start))}</div>
        <div class="sub">${m.result.ready(fmt.dateTime(start + rec.option.hours * MS_PER_HOUR), fmt.decimal(piece.lossPct, 1), Math.round((piece.mass * piece.lossPct) / 100))}</div>
        <div class="win">${m.result.window(fmt.dateTime(start + ws * MS_PER_HOUR), Number.isFinite(we) ? fmt.dateTime(start + we * MS_PER_HOUR) : m.result.windowOpenEnd)}</div>
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
        err = cover === v.covers[0] ? m.errors.tooFast(d) : m.errors.tooFastWith(d, coverLabel(m, cover));
      } else {
        const d = fmt.duration(rec.slowestHours);
        err = cover === v.covers[v.covers.length - 1] ? m.errors.tooSlow(d) : m.errors.tooSlowWith(d, coverLabel(m, cover));
      }
    }
    const extra = plan.excludedWouldMeet ? `<div class="extra">${esc(m.errors.excludedWouldMeet)}</div>` : '';
    html += `<div class="rec err"><div class="k">${m.result.warning}</div><div class="big">${esc(err)}</div>${extra}</div>`;
  }

  // comparison bars
  const finite = v.covers.map((c) => plan.singles[c.id]!).filter(Number.isFinite);
  const maxShown = Math.max(
    H > 0 ? H * CHART.deadlineHeadroom : CHART.noDeadlineHours,
    Math.min(Math.max(...finite, CHART.minFiniteHours), CHART.maxFiniteHours),
  );
  html += `<div class="card"><h2>${m.result.compareTitle}</h2><div class="bars">`;
  for (const c of v.covers) {
    const t = plan.singles[c.id]!;
    const pct = Math.min(100, ((Number.isFinite(t) ? t : maxShown) / maxShown) * 100);
    const off = !r.allowed.includes(c.id);
    const good = !off && H > 0 && Number.isFinite(t) && Math.abs(t - H) / H <= v.params.planner.targetTolerance;
    const n = r.calibration[c.id]!.samples;
    html += `<div class="bar${off ? ' off' : ''}"><div>${coverLabel(m, c)}${n ? ` <span class="muted">·${n}</span>` : ''}${off ? ` <span class="muted">· ${m.result.excludedBar}</span>` : ''}${c.environment === 'dampRoom' ? `<br><span class="muted note">${m.result.dampNote}</span>` : ''}</div>
        <div class="track"><div class="fill ${good ? 'good' : ''}" style="width:${pct}%"></div>${H > 0 ? `<div class="target" style="left:${Math.min(100, (H / maxShown) * 100)}%"></div>` : ''}</div>
        <div class="t">${fmt.duration(t)}${pct >= 100 && Number.isFinite(t) ? '+' : ''}</div></div>`;
  }
  html += `</div><div class="legend">${m.result.legend(H > 0 ? fmt.duration(H) : m.result.noDeadline)}</div>`;
  if (plan.alternatives.length) {
    html +=
      `<div class="muted alt-title">${m.result.alternatives}</div><ul class="alt">` +
      plan.alternatives.map((o) => `<li>${esc(planText(v, o, start))}</li>`).join('') +
      `</ul>`;
  }
  for (const tip of r.tips) html += `<div class="tip">${esc(m.tips[tip])}</div>`;
  if (r.canSave) html += `<div class="actions"><button class="main" id="savebtn">${m.result.save}</button></div>`;
  html += `</div>`;
  return html;
}

export function update(v: View, r: ResultModel): void {
  byId('result').innerHTML = renderResult(v, r);
}

export function mount(root: HTMLElement, ctx: AppContext): void {
  root.querySelector('#result')!.addEventListener('click', (e) => {
    if (closest(e, '#savebtn')) save(ctx);
  });
}
