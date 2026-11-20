// Section 5 "Moje prace i kalibracja": saved pieces, their feedback buttons and the calibration table.
import type { CoverCalibration } from '../../../domain/calibration';
import { feedbackToSample } from '../../../domain/calibration';
import type { CoverDefinition, CoverId } from '../../../domain/covers';
import { MS_PER_HOUR } from '../../../domain/params';
import { dominantCover } from '../../../domain/planner';
import { FEEDBACK_KINDS, type FeedbackKind } from '../../../domain/types';
import type { Messages } from '../../../i18n';
import type { StoredPiece } from '../../../storage/pieces';
import type { AppContext } from '../../context';
import { byId, closest, esc } from '../../dom';
import { NAME_MAX_LENGTH, readName } from '../../form';
import { icon } from '../../icons';
import { enter, exit, scrollBehavior } from '../../motion';
import { coverLabel, coverPhrase, planText, type View } from '../../render';

export function markup(m: Messages): string {
  return `<section class="card">
    <h2><span class="n">5</span>${icon('notebook')}${m.sections.pieces}</h2>
    <div id="pieces"></div>
    <div id="calib"></div>
  </section>`;
}

/**
 * A saved piece's plan sentence in the current language, rebuilt from `plan` the way `planText`
 * built it at save time. Unexpected plan shapes fall back to the stored `label`.
 */
function storedPlanText(v: View, p: StoredPiece): string {
  const find = (w: unknown): CoverDefinition | undefined => v.covers.find((c) => c.id === w);
  const plan = Array.isArray(p.plan) ? p.plan : [];
  const [a, b] = plan;
  const first = find(a?.w);
  const then = find(b?.w);
  if (plan.length === 1 && a && a.h === null && first)
    return v.m.plan.single(coverPhrase(v.m, first));
  if (
    plan.length === 2 &&
    a &&
    b &&
    first &&
    then &&
    typeof a.h === 'number' &&
    a.h > 0 &&
    Number.isFinite(a.h) &&
    b.h === null &&
    Number.isFinite(p.start)
  ) {
    return v.m.plan.twoPhase(
      coverPhrase(v.m, first),
      v.fmt.duration(a.h),
      v.fmt.dateTime(p.start + a.h * MS_PER_HOUR),
      coverPhrase(v.m, then),
    );
  }
  return p.label;
}

/** A saved piece's name and state badge (waiting / ready / rated), and its thrown and forecast times. */
export function pieceHighlights(
  v: View,
  p: StoredPiece,
  nowMs: number,
): { top: string; times: string } {
  const { m, fmt } = v;
  const ready = p.start + p.predH * MS_PER_HOUR;
  const left = (ready - nowMs) / MS_PER_HOUR;
  const status = p.fb
    ? `<span class="badge ok">${m.pieces.rated(m.pieces.feedbackResult[p.fb.kind], fmt.duration(p.fb.actualH))}</span>`
    : `<span class="badge">${left > 0 ? m.pieces.dueIn(fmt.duration(left)) : m.pieces.due}</span>`;
  return {
    top: `<div class="top"><b>${esc(p.name)}</b>${status}</div>`,
    times: m.pieces.meta(fmt.dateTime(p.start), fmt.dateTime(ready)),
  };
}

export function renderPieceList(v: View, pieces: readonly StoredPiece[], nowMs: number): string {
  const { m } = v;
  if (!pieces.length) return `<p class="muted empty">${m.pieces.empty}</p>`;
  return pieces
    .map((p) => {
      const h = pieceHighlights(v, p, nowMs);
      const buttons = FEEDBACK_KINDS.map(
        (k) => `
            <button class="ghost" data-fb="${k}" data-id="${p.id}">${m.pieces.feedbackButton[k]}</button>`,
      ).join('');
      return `<div class="piece" data-piece="${esc(p.id)}">
          ${h.top}
          <div class="meta">${esc(storedPlanText(v, p))}<br>${h.times}</div>
          <div class="fb">
            ${p.fb ? '' : `<span class="muted">${m.pieces.feedbackPrompt}</span>${buttons}`}
            <button class="ghost ren" data-rename="${esc(p.id)}" aria-label="${esc(m.pieces.renameLabel(p.name))}">${m.pieces.rename}</button>
            <button class="ghost del" data-del="${p.id}">${m.pieces.remove}</button>
          </div></div>`;
    })
    .join('');
}

function renderCalibration(v: View, calibration: Record<CoverId, CoverCalibration>): string {
  const { m, fmt } = v;
  const rows = v.covers.map((c) => ({ c, ...calibration[c.id]! })).filter((r) => r.samples);
  if (!rows.length) return '';
  return `<table><tr><th>${m.calibration.cover}</th><th>${m.calibration.multiplier}</th><th>${m.calibration.count}</th></tr>${rows
    .map(
      (r) =>
        `<tr><td>${coverLabel(m, r.c)}</td><td>${m.calibration.value(fmt.decimal(r.multiplier, 2))}</td><td>${r.samples}</td></tr>`,
    )
    .join('')}</table>
         <p class="muted">${m.calibration.noteHtml}</p>`;
}

/** Re-renders the piece list and the calibration table. */
export function render(ctx: AppContext): void {
  byId('pieces').innerHTML = renderPieceList(ctx.view, ctx.pieces, ctx.now());
  byId('calib').innerHTML = renderCalibration(ctx.view, ctx.perCover());
}

/** Saves the current plan as a new piece at the top of the list. */
export function save(ctx: AppContext): void {
  if (!ctx.saveable) return;
  const { piece, startMs, option, ws, we } = ctx.saveable;
  const dom = dominantCover(option.plan, ctx.view.params.planner.dominantFirstPhaseHours);
  const p: StoredPiece = {
    id: ctx.now().toString(36),
    name: readName() || ctx.view.m.pieces.defaultName(ctx.pieces.length + 1),
    start: startMs,
    mass: piece.mass,
    lossPct: piece.lossPct,
    plan: option.plan.map((s) => ({ w: s.cover, h: Number.isFinite(s.hours) ? s.hours : null })),
    label: planText(ctx.view, option, startMs),
    dom,
    predH: option.hours,
    calUsed: ctx.calibration().estimate(dom).multiplier,
    ws,
    we,
    fb: null,
  };
  ctx.storePieces([p, ...ctx.pieces]);
  render(ctx);
  enter(byId('pieces').firstElementChild as HTMLElement);
  byId('pieces').scrollIntoView({ behavior: scrollBehavior(), block: 'start' });
}

function feedback(ctx: AppContext, id: string, kind: FeedbackKind): void {
  const p = ctx.pieces.find((x) => x.id === id);
  if (!p) return;
  const t = ctx.now();
  const outcome = feedbackToSample(
    { startMs: p.start, predictedHours: p.predH, multiplierUsed: p.calUsed },
    kind,
    t,
    ctx.view.params,
  );
  if (!outcome) return;
  p.fb = { kind, actualH: outcome.actualHours, sample: outcome.value, at: t };
  ctx.storePieces(ctx.pieces);
  render(ctx);
  ctx.compute();
}

/** Deletes the piece at once, then lets its row leave before the list re-renders. */
function remove(ctx: AppContext, id: string, row: HTMLElement): void {
  if (row.dataset.leaving) return;
  row.dataset.leaving = '1';
  ctx.storePieces(ctx.pieces.filter((x) => x.id !== id));
  void exit(row).then(() => {
    render(ctx);
    ctx.compute();
  });
}

/** Re-renders the list, closing an open rename, and focuses the piece's rename button. */
function closeRename(ctx: AppContext, id: string): void {
  render(ctx);
  byId('pieces')
    .querySelector<HTMLElement>(`[data-rename="${CSS.escape(id)}"]`)
    ?.focus();
}

/** Stores the trimmed new name; an empty or unchanged one keeps the old name. */
function rename(ctx: AppContext, id: string, name: string): void {
  const p = ctx.pieces.find((x) => x.id === id);
  const next = name.trim();
  if (p && next && next !== p.name) {
    p.name = next;
    ctx.storePieces(ctx.pieces);
  }
  closeRename(ctx, id);
}

/** Swaps the piece's name for an inline form; an open rename on another piece is dropped. */
function openRename(ctx: AppContext, id: string): void {
  const p = ctx.pieces.find((x) => x.id === id);
  if (!p) return;
  const { m } = ctx.view;
  render(ctx);
  const row = byId('pieces').querySelector<HTMLElement>(`[data-piece="${CSS.escape(id)}"]`)!;
  // no id on the input: a language switch captures and restores only inputs with an id
  row.querySelector('.top b')!.outerHTML = `<form class="rename" data-id="${esc(id)}">
      <input type="text" maxlength="${NAME_MAX_LENGTH}" aria-label="${esc(m.pieces.renameInput)}" value="${esc(p.name)}">
      <button class="ghost">${m.pieces.renameSave}</button>
      <button type="button" class="ghost" data-cancel>${m.pieces.renameCancel}</button>
    </form>`;
  const input = row.querySelector<HTMLInputElement>('.rename input')!;
  input.focus();
  input.select();
}

export function mount(root: HTMLElement, ctx: AppContext): void {
  const list = root.querySelector<HTMLElement>('#pieces')!;
  list.addEventListener('click', (e) => {
    const b = closest(e, '[data-fb], [data-del], [data-rename], [data-cancel]');
    if (b?.dataset.fb) feedback(ctx, b.dataset.id ?? '', b.dataset.fb as FeedbackKind);
    else if (b?.dataset.rename !== undefined) openRename(ctx, b.dataset.rename);
    else if (b?.hasAttribute('data-cancel'))
      closeRename(ctx, b.closest<HTMLElement>('form')!.dataset.id ?? '');
    else if (b) remove(ctx, b.dataset.del ?? '', b.closest<HTMLElement>('.piece')!);
  });
  list.addEventListener('submit', (e) => {
    e.preventDefault();
    const form = e.target as HTMLFormElement;
    rename(ctx, form.dataset.id ?? '', form.querySelector('input')!.value);
  });
  list.addEventListener('keydown', (e) => {
    const form = (e.target as HTMLElement).closest<HTMLElement>('form.rename');
    if (e.key !== 'Escape' || !form) return;
    e.preventDefault();
    closeRename(ctx, form.dataset.id ?? '');
  });
}
