// First-run wizard: shows the [data-step] sections one at a time, then the whole page.
import type { Messages } from '../../../i18n';
import type { WizardOutcome, WizardStore } from '../../../storage/wizard';
import { byId, closest } from '../../dom';

/** Bar above section 1: back to the welcome screen, the wizard's progress and its skip button. */
export function barMarkup(m: Messages): string {
  return `<div class="wizard-bar">
    <button type="button" class="ghost" id="welcome-back">${m.welcome.back}</button>
    <p class="wizard-progress wizard-only" id="wizard-progress" aria-live="polite"></p>
    <button type="button" class="ghost wizard-only" id="wizard-skip">${m.wizard.skip}</button>
  </div>`;
}

/** Back / next buttons below the result. */
export function navMarkup(m: Messages): string {
  return `<nav class="wizard-nav wizard-only" aria-label="${m.wizard.label}">
    <button type="button" class="ghost" id="wizard-back">${m.wizard.back}</button>
    <button type="button" class="main" id="wizard-next">${m.wizard.next}</button>
  </nav>`;
}

export interface Wizard {
  /** applies the state to a freshly rendered shell (first render and after a language switch) */
  mount(m: Messages): void;
  /** opens the wizard at step 1 and moves focus to its heading */
  start(): void;
  /** shows the whole page without recording an outcome */
  close(): void;
}

export function createWizard(root: HTMLElement, store: WizardStore, onEnd: (outcome: WizardOutcome) => void): Wizard {
  let open = store.load() === null;
  let step = 0;
  let m: Messages;

  const steps = (): HTMLElement[] => [...root.querySelectorAll<HTMLElement>('[data-step]')];
  const titles = (): string[] => [m.sections.piece, m.sections.conditions, m.sections.schedule];
  const focusTarget = (i: number): HTMLElement => steps()[i]!.querySelector('h2')!;
  const focus = (el: HTMLElement): void => {
    el.tabIndex = -1;
    el.focus();
  };

  function show(i: number, moveFocus: boolean): void {
    step = i;
    const all = steps();
    const last = all.length - 1;
    root.classList.toggle('wizard', open);
    all.forEach((s, k) => {
      s.classList.toggle('current', open && k === i);
    });
    byId('wizard-progress').textContent = open ? m.wizard.progress(i + 1, all.length, titles()[i]!) : '';
    byId('wizard-back').hidden = i === 0;
    byId('wizard-next').textContent = i === last ? m.wizard.finish : m.wizard.next;
    if (open && moveFocus) focus(focusTarget(i));
  }

  function end(outcome: WizardOutcome): void {
    if (!open) return;
    store.save(outcome);
    open = false;
    show(0, false);
    onEnd(outcome);
  }

  // root outlives every render, so one listener serves every shell
  root.addEventListener('click', (e) => {
    const id = closest(e, 'button')?.id;
    if (id === 'wizard-next') {
      if (step < steps().length - 1) return show(step + 1, true);
      end('done');
      focus(byId('result'));
    } else if (id === 'wizard-back') {
      show(step - 1, true);
    } else if (id === 'wizard-skip') {
      end('skipped');
      focus(focusTarget(0));
    }
  });

  function mount(messages: Messages): void {
    m = messages;
    show(open ? step : 0, false);
  }

  function start(): void {
    open = true;
    show(0, true);
  }

  function close(): void {
    open = false;
    show(0, false);
  }

  return { mount, start, close };
}
