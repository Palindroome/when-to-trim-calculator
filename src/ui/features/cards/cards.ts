// Sections 1–3 as summary cards: after the wizard each collapses to one line and opens on click.
import type { Conditions, PieceInput } from '../../../domain/types';
import type { Messages } from '../../../i18n';
import { closest } from '../../dom';
import type { View } from '../../render';

/** A numbered form section (1–3) with its collapse toggle and summary line; `body` is its fields. */
export function stepCard(n: number, title: string, body: string): string {
  return `<section class="card" data-step>
    <div class="card-head">
      <h2><span class="n">${n}</span>${title}</h2>
      <button type="button" class="ghost toggle compact-only" aria-expanded="true" aria-controls="body-${n}"></button>
    </div>
    <p class="summary compact-only"></p>
    <div class="card-body" id="body-${n}">
    ${body}
    </div>
  </section>`;
}

export interface SummaryInput {
  name: string;
  piece: PieceInput;
  conditions: Conditions;
  thrownMs: number;
  /** NaN when no trim date is set */
  whenMs: number;
}

/** One-line summaries of sections 1–3 (Praca, Warunki, Termin) for the collapsed cards. */
export function renderSummaries(v: View, s: SummaryInput): [string, string, string] {
  const { m, fmt } = v;
  const n = (x: number): string => fmt.decimal(x, Number.isInteger(x) ? 0 : 1);
  const { piece: p, conditions: c } = s;
  return [
    m.summary.piece(s.name, m.options.shape[p.shape], n(p.massG), n(p.wallMm), n(p.baseMm ?? p.wallMm), m.options.clay[p.clay]),
    m.summary.conditions(
      n(c.temp),
      n(c.rh),
      m.options.airflow[c.airflow],
      c.night ? { temp: n(c.nightTemp), rh: n(c.nightRh) } : undefined,
    ),
    m.summary.schedule(fmt.dateTime(s.thrownMs), Number.isFinite(s.whenMs) ? fmt.dateTime(s.whenMs) : m.result.noDeadline),
  ];
}

export interface SummaryCards {
  /** applies the state to a freshly rendered shell (first render and after a language switch) */
  mount(m: Messages): void;
  /** on: every card collapsed to its summary; off: the plain, expanded form */
  set(on: boolean): void;
  /** summary line per card, in order */
  update(summaries: readonly string[]): void;
}

export function createSummaryCards(root: HTMLElement, initiallyOn: boolean): SummaryCards {
  let on = initiallyOn;
  const expanded = new Set<number>();
  let m: Messages;

  const cards = (): HTMLElement[] => [...root.querySelectorAll<HTMLElement>('[data-step]')];

  function apply(): void {
    const titles = [m.sections.piece, m.sections.conditions, m.sections.schedule];
    root.classList.toggle('compact', on);
    cards().forEach((card, i) => {
      const open = !on || expanded.has(i);
      card.classList.toggle('collapsed', !open);
      const t = card.querySelector<HTMLButtonElement>('.toggle')!;
      t.setAttribute('aria-expanded', String(open));
      t.textContent = open ? m.summary.collapse : m.summary.edit;
      t.setAttribute('aria-label', open ? m.summary.collapseLabel(titles[i]!) : m.summary.editLabel(titles[i]!));
    });
  }

  // root outlives every render, so one listener serves every shell
  root.addEventListener('click', (e) => {
    const card = closest(e, '.toggle')?.closest<HTMLElement>('[data-step]');
    if (!card) return;
    const i = cards().indexOf(card);
    if (!expanded.delete(i)) expanded.add(i);
    apply();
  });

  return {
    mount(messages) {
      m = messages;
      apply();
    },
    set(value) {
      on = value;
      expanded.clear();
      apply();
    },
    update(summaries) {
      cards().forEach((card, i) => {
        card.querySelector('.summary')!.textContent = summaries[i] ?? '';
      });
    },
  };
}
