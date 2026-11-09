// Sections 1–3 as summary cards: after the wizard each collapses to one line and opens on click.
import type { Messages } from '../i18n';

export interface SummaryCards {
  /** binds a freshly rendered shell (first render and after a language switch) */
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

  return {
    mount(messages) {
      m = messages;
      cards().forEach((card, i) => {
        card.querySelector<HTMLButtonElement>('.toggle')!.onclick = () => {
          if (!expanded.delete(i)) expanded.add(i);
          apply();
        };
      });
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
