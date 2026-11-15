// Section 3 date-time pickers: a day button opening a calendar dialog (Cally), a 24 h time field and quick choices.
import 'cally';
import type { Messages } from '../../../i18n';
import type { AppContext } from '../../context';
import { byId, closest } from '../../dom';
import {
  type DateTimeId,
  dayLabel,
  normalizeTime,
  readThrownMs,
  toDayKey,
  toTime,
} from '../../form';
import { icon } from '../../icons';
import { slideIndicator } from '../../motion';

const QUICK_DAYS = [1, 2, 3, 5, 7] as const;

/** Quick choices for the throwing time, keys of `m.dateTime.presets`. */
const THROWN_PRESETS = ['now', 'hourAgo', 'morning', 'lastEvening'] as const;
type ThrownPreset = (typeof THROWN_PRESETS)[number];

/** Default trim date offered on load: thrown + 2 days, at 10:00. */
const DEFAULT_QUICK_DAYS = 2;
const QUICK_DATE_HOUR = 10;
/** Thrown presets "dziś rano" (today) and "wczoraj wieczorem" (yesterday). */
const MORNING_HOUR = 8;
const EVENING_HOUR = 19;
const DATE_IDS: readonly DateTimeId[] = ['thrown', 'when'];

/** The parts of Cally's `<calendar-date>` the app drives. */
interface CalendarDate extends HTMLElement {
  value: string;
  focusedDate: string | undefined;
  today: string;
  max: string;
  /** extra CSS part names for a day (a Date at UTC midnight) */
  getDayParts: (date: Date) => string;
  updated: Promise<void>;
}

/**
 * One date-time field: a day button that opens a calendar (Cally) in a dialog, a 24 h time text field
 * and quick-choice buttons. The chosen day key lives in the hidden `<id>-day`; this module fills the
 * button text and sets up the calendar. Every control is named "<field> <part>".
 */
function dateTimeField(
  m: Messages,
  id: DateTimeId,
  legend: string,
  chipsId: string,
  chips: string,
): string {
  const d = m.dateTime;
  return `<fieldset class="datetime">
        <legend id="${id}-legend">${legend}</legend>
        <div class="dt-row">
          <div class="dt-day"><label id="${id}-day-label" for="${id}-day-btn">${d.day}</label>
            <input id="${id}-day" type="hidden">
            <button type="button" class="day-btn" id="${id}-day-btn" aria-haspopup="dialog" aria-controls="${id}-cal" aria-labelledby="${id}-legend ${id}-day-label ${id}-day-text">
              <span id="${id}-day-text"></span>
              ${icon('calendar')}
            </button></div>
          <div class="dt-time"><label id="${id}-time-label" for="${id}-time">${d.time}</label>
            <input id="${id}-time" type="text" inputmode="numeric" autocomplete="off" placeholder="${d.timePlaceholder}" aria-labelledby="${id}-legend ${id}-time-label"></div>
        </div>
        <p class="field-msg hide" id="${id}-time-msg">${d.invalidTime}</p>
        <div class="chips" id="${chipsId}">
          ${chips}
        </div>
        <dialog class="calendar" id="${id}-cal" aria-labelledby="${id}-legend">
          <calendar-date id="${id}-calendar" locale="${m.lang}" first-day-of-week="1">
            <span slot="heading" id="${id}-cal-heading" aria-hidden="true"></span>
            <span slot="previous">${icon('chevronLeft')}<span class="vh">${d.previousMonth}</span></span>
            <span slot="next">${icon('chevronRight')}<span class="vh">${d.nextMonth}</span></span>
            <calendar-month></calendar-month>
          </calendar-date>
        </dialog>
      </fieldset>`;
}

export function markup(m: Messages): string {
  const f = m.fields;
  return `<div class="dates">
      ${dateTimeField(m, 'thrown', f.thrown, 'thrown-quick', THROWN_PRESETS.map((p) => `<button type="button" class="chip" data-preset="${p}" aria-pressed="false">${m.dateTime.presets[p]}</button>`).join('\n          '))}
      ${dateTimeField(m, 'when', f.when, 'quick', QUICK_DAYS.map((d) => `<button type="button" class="chip" data-d="${d}" aria-pressed="false">${m.quickDate(d)}</button>`).join('\n          '))}
    </div>`;
}

const chips = (root: HTMLElement): NodeListOf<HTMLButtonElement> =>
  root.querySelectorAll<HTMLButtonElement>('#quick .chip');
const presets = (root: HTMLElement): NodeListOf<HTMLButtonElement> =>
  root.querySelectorAll<HTMLButtonElement>('#thrown-quick .chip');
/**
 * Highlights the buttons for which `on` holds, for sight (`.on`) and for assistive tech (`aria-pressed`);
 * the highlight slides over from the previously chosen button.
 */
const press = (
  buttons: NodeListOf<HTMLButtonElement>,
  on: (b: HTMLButtonElement) => boolean,
): void => {
  const group = buttons[0]!.parentElement!;
  const from = group.querySelector('.chip.on')?.getBoundingClientRect();
  buttons.forEach((b) => {
    b.classList.toggle('on', on(b));
    b.setAttribute('aria-pressed', String(on(b)));
  });
  slideIndicator(group, from, group.querySelector<HTMLElement>('.chip.on'));
};

function setWhenDays(root: HTMLElement, ctx: AppContext, days: number): void {
  const t = new Date(readThrownMs(ctx.now()));
  t.setDate(t.getDate() + days);
  t.setHours(QUICK_DATE_HOUR, 0, 0, 0);
  setDateTime(ctx, 'when', t.getTime());
  press(chips(root), (c) => +(c.dataset.d ?? NaN) === days);
}

function setThrownPreset(root: HTMLElement, ctx: AppContext, preset: ThrownPreset): void {
  const t = new Date(ctx.now());
  t.setSeconds(0, 0);
  if (preset === 'hourAgo') t.setHours(t.getHours() - 1);
  if (preset === 'morning') t.setHours(MORNING_HOUR, 0);
  if (preset === 'lastEvening') {
    t.setDate(t.getDate() - 1);
    t.setHours(EVENING_HOUR, 0);
  }
  setDateTime(ctx, 'thrown', t.getTime());
  press(presets(root), (b) => b.dataset.preset === preset);
}

/** Puts a time into a picker: the day key, the button text and the time field. */
function setDateTime(ctx: AppContext, id: DateTimeId, ms: number): void {
  const d = new Date(ms);
  byId<HTMLInputElement>(`${id}-day`).value = toDayKey(d);
  byId<HTMLInputElement>(`${id}-time`).value = toTime(d);
  showDay(ctx, id);
  checkTime(id, true);
}

/** Writes the chosen day onto its button, e.g. "dziś · śr 4.03". */
function showDay(ctx: AppContext, id: DateTimeId): void {
  byId(`${id}-day-text`).textContent = dayLabel(
    ctx.view.m,
    ctx.view.fmt,
    byId<HTMLInputElement>(`${id}-day`).value,
    ctx.now(),
  );
}

const calendar = (id: DateTimeId): CalendarDate => byId<CalendarDate>(`${id}-calendar`);

/** Opens the calendar on the chosen day; today, and in the trim calendar the throwing day, are marked. */
function openCalendar(ctx: AppContext, id: DateTimeId): void {
  const cal = calendar(id);
  const day = byId<HTMLInputElement>(`${id}-day`).value;
  const today = toDayKey(new Date(ctx.now()));
  cal.today = today;
  if (id === 'thrown') cal.max = today; // a piece cannot be thrown in the future
  const thrown = byId<HTMLInputElement>('thrown-day').value;
  // a new function each time, so the calendar re-renders with the current throwing day
  cal.getDayParts = (date) =>
    id === 'when' && date.toISOString().slice(0, 10) === thrown ? 'thrown' : '';
  cal.value = day;
  cal.focusedDate = day;
  showMonth(ctx, id, new Date(`${day}T00:00Z`));
  byId<HTMLDialogElement>(`${id}-cal`).showModal();
  void cal.updated.then(() => cal.focus());
}

/**
 * Visible month heading, e.g. "marzec 2026": Cally's own header shows only the year, and its month
 * heading sits apart from the paging buttons. Screen readers get Cally's live "month year" text instead.
 */
function showMonth(ctx: AppContext, id: DateTimeId, utcDay: Date): void {
  if (Number.isNaN(utcDay.getTime())) return;
  byId(`${id}-cal-heading`).textContent = new Intl.DateTimeFormat(ctx.view.m.lang, {
    month: 'long',
    year: 'numeric',
    timeZone: 'UTC',
  }).format(utcDay);
}

/** A day picked in the calendar: store it, close the dialog (focus returns to the button), recalculate. */
function pickDay(ctx: AppContext, id: DateTimeId): void {
  const input = byId<HTMLInputElement>(`${id}-day`);
  input.value = calendar(id).value;
  showDay(ctx, id);
  byId<HTMLDialogElement>(`${id}-cal`).close();
  // the same path as typing into a field: clears the quick choice and recalculates
  input.dispatchEvent(new Event('input', { bubbles: true }));
}

/**
 * Flags a time that cannot be read. While typing (`done` false) it only clears the flag, so a half-typed
 * "9:" is not reported; on leaving the field (`done`) a valid time is written out as HH:MM.
 */
function checkTime(id: DateTimeId, done: boolean): void {
  const input = byId<HTMLInputElement>(`${id}-time`);
  const time = normalizeTime(input.value);
  if (time && done) input.value = time;
  const invalid = !time && input.value.trim() !== '';
  if (invalid && !done) return;
  byId(`${id}-time-msg`).classList.toggle('hide', !invalid);
  if (invalid) {
    input.setAttribute('aria-invalid', 'true');
    input.setAttribute('aria-describedby', `${id}-time-msg`);
  } else {
    input.removeAttribute('aria-invalid');
    input.removeAttribute('aria-describedby');
  }
}

/** Times offered on load: thrown now, trimmed in two days at 10:00. */
export function reset(root: HTMLElement, ctx: AppContext): void {
  const start = new Date(ctx.now());
  start.setSeconds(0, 0);
  setDateTime(ctx, 'thrown', start.getTime());
  setWhenDays(root, ctx, DEFAULT_QUICK_DAYS);
}

/** The pressed quick choices, kept across a language switch (the fields themselves are kept with the form). */
export interface DateTimeState {
  /** `data-d` of the selected quick-date chip */
  quick: string | undefined;
  /** `data-preset` of the selected thrown preset */
  thrownPreset: string | undefined;
}

export function capture(root: HTMLElement): DateTimeState {
  return {
    quick: root.querySelector<HTMLElement>('#quick .chip.on')?.dataset.d,
    thrownPreset: root.querySelector<HTMLElement>('#thrown-quick .chip.on')?.dataset.preset,
  };
}

/** Re-applies the quick choices and redraws the day buttons and time flags from the restored fields. */
export function restore(root: HTMLElement, ctx: AppContext, s: DateTimeState): void {
  press(chips(root), (c) => c.dataset.d === s.quick);
  press(presets(root), (b) => b.dataset.preset === s.thrownPreset);
  for (const id of DATE_IDS) {
    showDay(ctx, id);
    checkTime(id, true);
  }
}

export function mount(root: HTMLElement, ctx: AppContext): void {
  const dates = root.querySelector<HTMLElement>('.dates')!;
  dates.addEventListener('click', (e) => {
    const b = closest<HTMLButtonElement>(e, 'button');
    if (!b) return;
    if (b.matches('#quick .chip')) {
      setWhenDays(root, ctx, +(b.dataset.d ?? NaN));
      ctx.compute();
    } else if (b.matches('#thrown-quick .chip')) {
      setThrownPreset(root, ctx, b.dataset.preset as ThrownPreset);
      ctx.compute();
    } else {
      const id = DATE_IDS.find((d) => b.id === `${d}-day-btn`);
      if (id) openCalendar(ctx, id);
    }
  });
  // typing a time or picking a day clears that field's quick choice
  dates.addEventListener('input', (e) => {
    const id = (e.target as HTMLElement).id;
    if (id.startsWith('when-')) press(chips(root), () => false);
    if (id.startsWith('thrown-')) press(presets(root), () => false);
    ctx.compute();
  });
  for (const id of DATE_IDS) {
    const button = byId<HTMLButtonElement>(`${id}-day-btn`);
    const dialog = byId<HTMLDialogElement>(`${id}-cal`);
    calendar(id).addEventListener('change', () => pickDay(ctx, id));
    // also fired when paging moves the focused day into another month
    calendar(id).addEventListener('focusday', (e) =>
      showMonth(ctx, id, (e as CustomEvent<Date>).detail),
    );
    // Escape closes the dialog natively; a click on the backdrop lands on the dialog element itself
    dialog.addEventListener('click', (e) => {
      if (e.target === dialog) dialog.close();
    });
    dialog.addEventListener('close', () => button.focus());
    const time = byId<HTMLInputElement>(`${id}-time`);
    time.addEventListener('input', () => checkTime(id, false));
    time.addEventListener('change', () => checkTime(id, true));
  }
}
