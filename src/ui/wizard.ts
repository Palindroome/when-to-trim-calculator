// First-run wizard: shows the [data-step] sections one at a time, then the full form.
import type { Messages } from '../i18n';
import type { WizardOutcome, WizardStore } from '../storage/wizard';
import { byId } from './dom';

export interface Wizard {
  /** binds the controls of a freshly rendered shell (first render and after a language switch) */
  mount(m: Messages): void;
  /** if the wizard is open: remembers the outcome, leaves it and shows the full form */
  end(outcome: WizardOutcome): void;
}

export function createWizard(root: HTMLElement, store: WizardStore): Wizard {
  let open = store.load() === null;
  let step = 0;
  let m: Messages;

  const steps = (): HTMLElement[] => [...root.querySelectorAll<HTMLElement>('[data-step]')];
  const titles = (): string[] => [m.sections.piece, m.sections.conditions, m.sections.schedule, m.wizard.resultStep];
  // focus target of a step: its heading, or the whole result on the last step
  const focusTarget = (i: number): HTMLElement => {
    const s = steps()[i]!;
    return i === steps().length - 1 ? s : s.querySelector('h2')!;
  };
  const focus = (el: HTMLElement): void => {
    el.tabIndex = -1;
    el.focus();
  };

  function show(i: number, moveFocus: boolean): void {
    step = i;
    const all = steps();
    const last = all.length - 1;
    root.classList.toggle('wizard', open);
    all.forEach((s, k) => s.classList.toggle('current', open && k === i));
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
  }

  function mount(messages: Messages): void {
    m = messages;
    byId('wizard-next').onclick = () => {
      if (step < steps().length - 1) return show(step + 1, true);
      end('done');
      focus(byId('result'));
    };
    byId('wizard-back').onclick = () => show(step - 1, true);
    byId('wizard-skip').onclick = () => {
      end('skipped');
      focus(focusTarget(0));
    };
    byId('wizard-open').onclick = () => {
      open = true;
      show(0, true);
    };
    show(open ? step : 0, false);
  }

  return { mount, end };
}
