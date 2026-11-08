// HTML builders for the dynamic parts of the page. Pure functions of their inputs.
import type { CoverCalibration } from '../domain/calibration';
import { MS_PER_HOUR, type ModelParams } from '../domain/params';
import type { PlanOption, PlanResult } from '../domain/planner';
import type { TipId } from '../domain/tips';
import { COVERS, FEEDBACK_KINDS, type Cover, type Piece } from '../domain/types';
import type { WeightAssessment } from '../domain/weight';
import type { Formatter, Messages } from '../i18n';
import type { StoredPiece } from '../storage/pieces';
import { esc } from './dom';

export interface View {
  m: Messages;
  fmt: Formatter;
  params: ModelParams;
}

/** Comparison chart scale: deadline × 1.6, or at least 48 h; the longest finite bar counts between 24 h and 10 days. */
const CHART = { deadlineHeadroom: 1.6, noDeadlineHours: 48, minFiniteHours: 24, maxFiniteHours: 24 * 10 } as const;

export function planText(v: View, o: PlanOption, startMs: number): string {
  if (o.kind === 'single') return v.m.plan.single(o.cover);
  return v.m.plan.twoPhase(
    o.first,
    v.fmt.duration(o.switchAfterHours),
    v.fmt.dateTime(startMs + o.switchAfterHours * MS_PER_HOUR),
    o.then,
  );
}

export interface ResultModel {
  piece: Piece;
  startMs: number;
  plan: PlanResult;
  /** working window (hours after throwing) — only for an on-target recommendation */
  window?: { start: number; end: number };
  tips: TipId[];
  calibration: Record<Cover, CoverCalibration>;
  canSave: boolean;
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
        <div class="win">${m.result.window(fmt.dateTime(start + ws * MS_PER_HOUR), isFinite(we) ? fmt.dateTime(start + we * MS_PER_HOUR) : m.result.windowOpenEnd)}</div>
      </div>`;
  } else if (rec.status !== 'onTarget') {
    const err =
      rec.status === 'invalidDeadline'
        ? m.errors.invalidDeadline
        : rec.status === 'tooFast'
          ? m.errors.tooFast(fmt.duration(rec.fastestHours))
          : m.errors.tooSlow(fmt.duration(rec.slowestHours));
    html += `<div class="rec"><div class="k">${m.result.warning}</div><div class="big" style="font-size:18px">${esc(err)}</div></div>`;
  }

  // comparison bars
  const finite = COVERS.map((c) => plan.singles[c]).filter(isFinite);
  const maxShown = Math.max(
    H > 0 ? H * CHART.deadlineHeadroom : CHART.noDeadlineHours,
    Math.min(Math.max(...finite, CHART.minFiniteHours), CHART.maxFiniteHours),
  );
  html += `<div class="card"><h2>${m.result.compareTitle}</h2><div class="bars">`;
  for (const c of COVERS) {
    const t = plan.singles[c];
    const pct = Math.min(100, ((isFinite(t) ? t : maxShown) / maxShown) * 100);
    const good = H > 0 && isFinite(t) && Math.abs(t - H) / H <= v.params.planner.targetTolerance;
    const n = r.calibration[c].samples;
    html += `<div class="bar"><div>${m.covers.label[c]}${n ? ` <span class="muted">·${n}</span>` : ''}${c === 'damp' ? `<br><span class="muted" style="font-size:11.5px">${m.result.dampNote}</span>` : ''}</div>
        <div class="track"><div class="fill ${good ? 'good' : ''}" style="width:${pct}%"></div>${H > 0 ? `<div class="target" style="left:${Math.min(100, (H / maxShown) * 100)}%"></div>` : ''}</div>
        <div class="t">${fmt.duration(t)}${pct >= 100 && isFinite(t) ? '+' : ''}</div></div>`;
  }
  html += `</div><div class="legend">${m.result.legend(H > 0 ? fmt.duration(H) : m.result.noDeadline)}</div>`;
  if (plan.alternatives.length) {
    html +=
      `<div class="muted" style="margin-top:12px">${m.result.alternatives}</div><ul class="alt">` +
      plan.alternatives.map((o) => `<li>${esc(planText(v, o, start))}</li>`).join('') +
      `</ul>`;
  }
  for (const tip of r.tips) html += `<div class="tip">${esc(m.tips[tip])}</div>`;
  if (r.canSave) html += `<div style="margin-top:12px"><button class="main" id="savebtn">${m.result.save}</button></div>`;
  html += `</div>`;
  return html;
}

export function renderPieceList(v: View, pieces: readonly StoredPiece[], nowMs: number): string {
  const { m, fmt } = v;
  if (!pieces.length) return `<p class="muted" style="margin:0 0 6px">${m.pieces.empty}</p>`;
  return pieces
    .map((p) => {
      const ready = p.start + p.predH * MS_PER_HOUR;
      const left = (ready - nowMs) / MS_PER_HOUR;
      const status = p.fb
        ? `<span class="badge ok">${m.pieces.rated(m.pieces.feedbackResult[p.fb.kind], fmt.duration(p.fb.actualH))}</span>`
        : `<span class="badge">${left > 0 ? m.pieces.dueIn(fmt.duration(left)) : m.pieces.due}</span>`;
      const buttons = FEEDBACK_KINDS.map(
        (k) => `
            <button class="ghost" data-fb="${k}" data-id="${p.id}">${m.pieces.feedbackButton[k]}</button>`,
      ).join('');
      return `<div class="piece">
          <div class="top"><b>${esc(p.name)}</b>${status}</div>
          <div class="meta">${esc(p.label)}<br>${m.pieces.meta(fmt.dateTime(p.start), fmt.dateTime(ready))}</div>
          <div class="fb">
            ${p.fb ? '' : `<span class="muted" style="align-self:center">${m.pieces.feedbackPrompt}</span>${buttons}`}
            <button class="ghost" data-del="${p.id}" style="margin-left:auto">${m.pieces.remove}</button>
          </div></div>`;
    })
    .join('');
}

export function renderCalibration(v: View, calibration: Record<Cover, CoverCalibration>): string {
  const { m, fmt } = v;
  const rows = COVERS.map((c) => ({ c, ...calibration[c] })).filter((r) => r.samples);
  if (!rows.length) return '';
  return `<table><tr><th>${m.calibration.cover}</th><th>${m.calibration.multiplier}</th><th>${m.calibration.count}</th></tr>${rows
    .map(
      (r) =>
        `<tr><td>${m.covers.label[r.c]}</td><td>${m.calibration.value(fmt.decimal(r.multiplier, 2))}</td><td>${r.samples}</td></tr>`,
    )
    .join('')}</table>
         <p class="muted">${m.calibration.noteHtml}</p>`;
}

export function renderWeight(v: View, a: WeightAssessment | null): string {
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
