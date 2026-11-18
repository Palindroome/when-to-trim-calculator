// Numeric fields with their unit badge and up/down buttons; the arrow keys step the focused field too.
import type { Messages } from '../i18n';
import { byId, closest } from './dom';
import {
  LARGE_STEP,
  NUMBER_FIELDS,
  type NumberFieldId,
  numberMessageMarkup,
  parseNumber,
  stepNumber,
} from './form';
import { icon } from './icons';

/**
 * A numeric text input with its unit, two stepper buttons and the inline message `checkNumber` fills;
 * `attrs` adds e.g. its value or placeholder.
 */
export function numberField(
  m: Messages,
  id: NumberFieldId,
  label: string,
  unit: string,
  attrs: string,
): string {
  const button = (dir: 1 | -1, text: string, name: 'chevronUp' | 'chevronDown') =>
    `<button type="button" tabindex="-1" data-delta="${dir}" aria-controls="${id}" aria-label="${text}">${icon(name)}</button>`;
  return `<div class="unit stepper"><input id="${id}" type="text" inputmode="decimal" autocomplete="off" aria-keyshortcuts="ArrowUp ArrowDown" ${attrs}><span>${unit}</span><div class="stepper-buttons">${button(1, m.fields.stepUp(label), 'chevronUp')}${button(-1, m.fields.stepDown(label), 'chevronDown')}</div></div>${numberMessageMarkup(id)}`;
}

/** What an empty field steps from: the value of its `stepFrom` field, or its fallback. */
function fallbackOf(id: NumberFieldId): number {
  const { fallback, stepFrom } = NUMBER_FIELDS[id];
  return stepFrom
    ? parseNumber(byId<HTMLInputElement>(stepFrom).value, fallbackOf(stepFrom))
    : fallback;
}

/** Steps a numeric field and lets the page recalculate as if the value had been typed. */
function step(m: Messages, input: HTMLInputElement, steps: number): void {
  const id = input.id as NumberFieldId;
  input.value = stepNumber(
    input.value,
    NUMBER_FIELDS[id],
    steps,
    fallbackOf(id),
    m.format.decimalSeparator,
  );
  input.dispatchEvent(new Event('input', { bubbles: true }));
}

const KEY_STEPS: Record<string, number> = {
  ArrowUp: 1,
  ArrowDown: -1,
  PageUp: LARGE_STEP,
  PageDown: -LARGE_STEP,
};

/** Wires the stepper buttons and arrow keys of the numeric fields inside `el`. */
export function mountSteppers(el: Element, m: Messages): void {
  el.addEventListener('click', (e) => {
    const button = closest(e, 'button[data-delta]');
    if (!button) return;
    step(
      m,
      byId<HTMLInputElement>(button.getAttribute('aria-controls')!),
      Number(button.dataset.delta),
    );
  });
  el.addEventListener('keydown', (e) => {
    const ev = e as KeyboardEvent;
    const steps = KEY_STEPS[ev.key];
    if (!steps || ev.altKey || ev.ctrlKey || ev.metaKey) return;
    const input = closest<HTMLInputElement>(ev, '.stepper input');
    if (!input) return;
    ev.preventDefault();
    step(m, input, ev.shiftKey && Math.abs(steps) === 1 ? steps * LARGE_STEP : steps);
  });
}
