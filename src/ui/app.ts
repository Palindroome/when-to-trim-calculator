import type { CalibratorFactory, CoverCalibration } from '../domain/calibration';
import { feedbackToSample } from '../domain/calibration';
import type { ConditionsSource } from '../domain/conditions';
import type { CoverId } from '../domain/covers';
import { type ModelParams, MS_PER_HOUR } from '../domain/params';
import type { RateModel } from '../domain/physics';
import { derivePiece } from '../domain/piece';
import { dominantCover, type PlanOption, planDrying } from '../domain/planner';
import { type DryingContext, simulate } from '../domain/simulate';
import { tipsFor } from '../domain/tips';
import type { FeedbackKind, Piece } from '../domain/types';
import { assessWeight } from '../domain/weight';
import { createFormatter, type Messages } from '../i18n';
import type { ActivityStore } from '../storage/activity';
import { calibrationSamples, type PieceRepository, type StoredPiece } from '../storage/pieces';
import type { Theme } from '../storage/preferences';
import type { WizardStore } from '../storage/wizard';
import { byId } from './dom';
import { renderFooter } from './footer';
import 'cally';
import { createSummaryCards } from './cards';
import {
  type DateTimeId,
  dayLabel,
  normalizeTime,
  readAllowedCovers,
  readName,
  readPieceInput,
  readThrownMs,
  readWeightInputs,
  readWhenMs,
  toDayKey,
  toTime,
} from './form';
import {
  coverLabel,
  planText,
  renderCalibration,
  renderPieceList,
  renderResult,
  renderSummaries,
  renderWeight,
  renderWelcomePieces,
  type View,
} from './render';
import { renderShell, type ThemeChoice, type ThrownPreset } from './shell';
import { createWelcome, shouldWelcome } from './welcome';
import { createWizard } from './wizard';

export interface AppDeps {
  root: HTMLElement;
  /** page footer, re-rendered with the language; optional so pages without one still work */
  footer?: HTMLElement;
  /** initial language */
  messages: Messages;
  /** languages offered by the switch, by locale code */
  locales: Readonly<Record<string, Messages>>;
  /** called with the locale code when the user picks a language */
  onLocaleChange: (code: string) => void;
  /** theme chosen earlier (null: follow the system); index.html has already applied it */
  theme: Theme | null;
  /** called when the user picks a theme (null: System) */
  onThemeChange: (theme: Theme | null) => void;
  params: ModelParams;
  repository: PieceRepository;
  wizard: WizardStore;
  /** time of the last interaction, for the welcome screen */
  activity: ActivityStore;
  /** pause after which the welcome screen is shown again (default: 1 hour) */
  idleResetMs?: number;
  conditions: ConditionsSource;
  rateModel: RateModel;
  calibrator: CalibratorFactory;
  now?: () => number;
}

/** Default trim date offered on load: thrown + 2 days, at 10:00. */
const DEFAULT_QUICK_DAYS = 2;
const QUICK_DATE_HOUR = 10;
/** Welcome screen again after this long without interaction. */
const DEFAULT_IDLE_RESET_MS = 60 * 60 * 1000;
/** Interactions are written to storage at most this often. */
const ACTIVITY_SAVE_MS = 60 * 1000;
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

/** Plan that can be saved with the current inputs. */
interface Saveable {
  piece: Piece;
  startMs: number;
  option: PlanOption;
  ws: number;
  we: number;
}

/** Everything the user has entered, kept across a language switch. */
interface FormState {
  fields: { id: string; value: string; checked: boolean }[];
  /** `data-d` of the selected quick-date chip */
  quick: string | undefined;
  /** `data-preset` of the selected thrown preset */
  thrownPreset: string | undefined;
  /** ticked cover checkboxes */
  allowed: CoverId[];
}

export function startApp(deps: AppDeps): void {
  const { root, params, repository, conditions, rateModel } = deps;
  const covers = params.covers;
  const coverIds = covers.map((c) => c.id);
  const now = deps.now ?? Date.now;
  let m: Messages;
  let view: View;

  let pieces: StoredPiece[] = repository.load();
  let saveable: Saveable | null = null;

  const calibration = () => deps.calibrator(calibrationSamples(pieces), params);

  const cards = createSummaryCards(root, deps.wizard.load() === 'done');
  const wizard = createWizard(root, deps.wizard, (outcome) => cards.set(outcome === 'done'));
  const welcome = createWelcome(root, {
    pieceCount: () => pieces.length,
    pieceRows: () => renderWelcomePieces(view, pieces, now()),
    onNew: () => {
      render(m, null);
      wizard.start();
    },
    onDetails: (id) => {
      wizard.close();
      // sections 1-3 as collapsed summary cards, so the piece is what the page opens on
      cards.set(true);
      const el = byId('pieces').querySelector<HTMLElement>(`[data-piece="${CSS.escape(id)}"]`)!;
      el.scrollIntoView({ block: 'start' });
      el.tabIndex = -1;
      el.focus({ preventScroll: true });
    },
  });

  const chips = (): NodeListOf<HTMLButtonElement> => root.querySelectorAll<HTMLButtonElement>('#quick .chip');
  const presets = (): NodeListOf<HTMLButtonElement> => root.querySelectorAll<HTMLButtonElement>('#thrown-quick .chip');
  /** Highlights the buttons for which `on` holds, for sight (`.on`) and for assistive tech (`aria-pressed`). */
  const press = (buttons: NodeListOf<HTMLButtonElement>, on: (b: HTMLButtonElement) => boolean): void => {
    buttons.forEach((b) => {
      b.classList.toggle('on', on(b));
      b.setAttribute('aria-pressed', String(on(b)));
    });
  };

  function context(piece: Piece, startMs: number): DryingContext {
    return {
      piece,
      conditions: conditions.read(),
      startMs,
      multipliers: calibration().multipliers(coverIds),
      model: rateModel,
      params,
      covers,
    };
  }

  /** Calibration of every cover, for the bars and the calibration table. */
  function perCover(): Record<CoverId, CoverCalibration> {
    const cal = calibration();
    const out = {} as Record<CoverId, CoverCalibration>;
    for (const c of coverIds) out[c] = cal.estimate(c);
    return out;
  }

  // ---------- recommendation ----------
  function compute(): void {
    const input = readPieceInput();
    const piece = derivePiece(input, params);
    const startMs = readThrownMs(now());
    const H = (readWhenMs() - startMs) / MS_PER_HOUR;
    const ctx = context(piece, startMs);
    const allowed = readAllowedCovers(covers);
    const plan = planDrying(ctx, H, input.stage, { allowed });
    const rec = plan.recommendation;

    let window: { start: number; end: number } | undefined;
    if (rec.status === 'onTarget') {
      const [ws, we] = simulate(rec.option.plan, ctx, [piece.softPct, piece.hardPct]) as [number, number];
      window = { start: ws, end: we };
      saveable = { piece, startMs, option: rec.option, ws, we };
    } else if (rec.status === 'invalidDeadline') {
      saveable = null;
    } else {
      saveable = { piece, startMs, option: rec.option, ws: NaN, we: NaN };
    }

    const result = byId('result');
    result.innerHTML = renderResult(view, {
      piece,
      startMs,
      plan,
      window,
      tips: tipsFor(rec, piece, ctx.conditions, params, covers),
      calibration: perCover(),
      canSave: saveable !== null,
      allowed,
    });
    cards.update(
      renderSummaries(view, { name: readName(), piece: input, conditions: ctx.conditions, thrownMs: startMs, whenMs: readWhenMs() }),
    );
    const saveBtn = document.getElementById('savebtn');
    if (saveBtn) saveBtn.onclick = savePiece;
    updateWeight();
  }

  // ---------- weight check ----------
  function updateWeight(): void {
    const w = readWeightInputs();
    const out = byId('wout');
    if (!(w.currentMassG > 0) || !(w.thrownMassG > 0)) {
      out.innerHTML = '';
      return;
    }
    const piece = derivePiece(readPieceInput(), params);
    const t = now();
    const ctx = context(piece, readThrownMs(t));
    out.innerHTML = renderWeight(view, assessWeight({ ...w, nowMs: t }, ctx));
  }

  // ---------- pieces ----------
  function savePiece(): void {
    if (!saveable) return;
    const { piece, startMs, option, ws, we } = saveable;
    const dom = dominantCover(option.plan, params.planner.dominantFirstPhaseHours);
    const p: StoredPiece = {
      id: now().toString(36),
      name: readName() || m.pieces.defaultName(pieces.length + 1),
      start: startMs,
      mass: piece.mass,
      lossPct: piece.lossPct,
      plan: option.plan.map((s) => ({ w: s.cover, h: Number.isFinite(s.hours) ? s.hours : null })),
      label: planText(view, option, startMs),
      dom,
      predH: option.hours,
      calUsed: calibration().estimate(dom).multiplier,
      ws,
      we,
      fb: null,
    };
    pieces.unshift(p);
    repository.save(pieces);
    renderPieces();
    byId('pieces').scrollIntoView({ behavior: 'smooth', block: 'start' });
  }

  function feedback(id: string, kind: FeedbackKind): void {
    const p = pieces.find((x) => x.id === id);
    if (!p) return;
    const t = now();
    const outcome = feedbackToSample({ startMs: p.start, predictedHours: p.predH, multiplierUsed: p.calUsed }, kind, t, params);
    if (!outcome) return;
    p.fb = { kind, actualH: outcome.actualHours, sample: outcome.value, at: t };
    repository.save(pieces);
    renderPieces();
    compute();
  }

  function removePiece(id: string): void {
    pieces = pieces.filter((x) => x.id !== id);
    repository.save(pieces);
    renderPieces();
    compute();
  }

  function renderPieces(): void {
    const el = byId('pieces');
    el.innerHTML = renderPieceList(view, pieces, now());
    el.querySelectorAll<HTMLElement>('[data-fb]').forEach((b) => {
      b.onclick = () => feedback(b.dataset.id ?? '', b.dataset.fb as FeedbackKind);
    });
    el.querySelectorAll<HTMLElement>('[data-del]').forEach((b) => {
      b.onclick = () => removePiece(b.dataset.del ?? '');
    });
    byId('calib').innerHTML = renderCalibration(view, perCover());
  }

  // ---------- dates ----------
  function setWhenDays(days: number): void {
    const t = new Date(readThrownMs(now()));
    t.setDate(t.getDate() + days);
    t.setHours(QUICK_DATE_HOUR, 0, 0, 0);
    setDateTime('when', t.getTime());
    press(chips(), (c) => +(c.dataset.d ?? NaN) === days);
  }

  function setThrownPreset(preset: ThrownPreset): void {
    const t = new Date(now());
    t.setSeconds(0, 0);
    if (preset === 'hourAgo') t.setHours(t.getHours() - 1);
    if (preset === 'morning') t.setHours(MORNING_HOUR, 0);
    if (preset === 'lastEvening') {
      t.setDate(t.getDate() - 1);
      t.setHours(EVENING_HOUR, 0);
    }
    setDateTime('thrown', t.getTime());
    press(presets(), (b) => b.dataset.preset === preset);
  }

  /** Puts a time into a picker: the day key, the button text and the time field. */
  function setDateTime(id: DateTimeId, ms: number): void {
    const d = new Date(ms);
    byId<HTMLInputElement>(`${id}-day`).value = toDayKey(d);
    byId<HTMLInputElement>(`${id}-time`).value = toTime(d);
    showDay(id);
    checkTime(id, true);
  }

  /** Writes the chosen day onto its button, e.g. "dziś · śr 4.03". */
  function showDay(id: DateTimeId): void {
    byId(`${id}-day-text`).textContent = dayLabel(m, view.fmt, byId<HTMLInputElement>(`${id}-day`).value, now());
  }

  const calendar = (id: DateTimeId): CalendarDate => byId<CalendarDate>(`${id}-calendar`);

  /** Opens the calendar on the chosen day; today, and in the trim calendar the throwing day, are marked. */
  function openCalendar(id: DateTimeId): void {
    const cal = calendar(id);
    const day = byId<HTMLInputElement>(`${id}-day`).value;
    const today = toDayKey(new Date(now()));
    cal.today = today;
    if (id === 'thrown') cal.max = today; // a piece cannot be thrown in the future
    const thrown = byId<HTMLInputElement>('thrown-day').value;
    // a new function each time, so the calendar re-renders with the current throwing day
    cal.getDayParts = (date) => (id === 'when' && date.toISOString().slice(0, 10) === thrown ? 'thrown' : '');
    cal.value = day;
    cal.focusedDate = day;
    showMonth(id, new Date(`${day}T00:00Z`));
    byId<HTMLDialogElement>(`${id}-cal`).showModal();
    void cal.updated.then(() => cal.focus());
  }

  /**
   * Visible month heading, e.g. "marzec 2026": Cally's own header shows only the year, and its month
   * heading sits apart from the paging buttons. Screen readers get Cally's live "month year" text instead.
   */
  function showMonth(id: DateTimeId, utcDay: Date): void {
    if (Number.isNaN(utcDay.getTime())) return;
    byId(`${id}-cal-heading`).textContent = new Intl.DateTimeFormat(m.lang, { month: 'long', year: 'numeric', timeZone: 'UTC' }).format(
      utcDay,
    );
  }

  /** A day picked in the calendar: store it, close the dialog (focus returns to the button), recalculate. */
  function pickDay(id: DateTimeId): void {
    const input = byId<HTMLInputElement>(`${id}-day`);
    input.value = calendar(id).value;
    showDay(id);
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

  // ---------- language ----------
  function captureForm(): FormState {
    return {
      fields: [...root.querySelectorAll<HTMLInputElement | HTMLSelectElement>('input[id],select')].map((e) => ({
        id: e.id,
        value: e.value,
        checked: e instanceof HTMLInputElement && e.checked,
      })),
      quick: root.querySelector<HTMLElement>('#quick .chip.on')?.dataset.d,
      thrownPreset: root.querySelector<HTMLElement>('#thrown-quick .chip.on')?.dataset.preset,
      allowed: readAllowedCovers(covers),
    };
  }

  function restoreForm(s: FormState): void {
    for (const f of s.fields) {
      const e = byId<HTMLInputElement | HTMLSelectElement>(f.id);
      e.value = f.value;
      if (e instanceof HTMLInputElement && e.type === 'checkbox') e.checked = f.checked;
    }
    press(chips(), (c) => c.dataset.d === s.quick);
    press(presets(), (b) => b.dataset.preset === s.thrownPreset);
    for (const id of DATE_IDS) {
      showDay(id);
      checkTime(id, true);
    }
    coverBoxes().forEach((b) => {
      b.checked = s.allowed.includes(b.dataset.cover as CoverId);
    });
  }

  // ---------- cover filter ----------
  const coverBoxes = (): NodeListOf<HTMLInputElement> => root.querySelectorAll<HTMLInputElement>('input[data-cover]');

  /** The last ticked cover cannot be unticked: disable it and show why. */
  function syncCovers(): void {
    const ticked = [...coverBoxes()].filter((b) => b.checked);
    coverBoxes().forEach((b) => {
      b.disabled = ticked.length === 1 && b.checked;
    });
    byId('covers-last').classList.toggle('hide', ticked.length !== 1);
  }

  function switchLanguage(code: string): void {
    const next = deps.locales[code];
    if (!next) return;
    deps.onLocaleChange(code);
    if (next === m) return;
    render(next, captureForm());
    root.querySelector<HTMLElement>(`[data-lang="${code}"]`)?.focus();
  }

  // ---------- theme ----------
  let theme = deps.theme;

  /** Applies the choice at once through `data-theme` on <html>; no re-render, nothing is recomputed. */
  function switchTheme(choice: ThemeChoice): void {
    theme = choice === 'system' ? null : choice;
    if (theme) document.documentElement.dataset.theme = theme;
    else delete document.documentElement.dataset.theme;
    root.querySelectorAll<HTMLButtonElement>('[data-theme-choice]').forEach((b) => {
      b.setAttribute('aria-pressed', String(b.dataset.themeChoice === choice));
    });
    deps.onThemeChange(theme);
  }

  // ---------- render ----------
  /** (Re)builds the page in `messages`; `form` restores the inputs after a language switch. */
  function render(messages: Messages, form: FormState | null): void {
    m = messages;
    view = { m, params, fmt: createFormatter(m, params.horizonHours / 24), covers };
    document.documentElement.lang = m.lang;
    document.title = m.title;
    root.innerHTML = renderShell(m, Object.keys(deps.locales), theme ?? 'system', covers);
    if (deps.footer) deps.footer.innerHTML = renderFooter(m);
    wizard.mount(m);
    cards.mount(m);
    welcome.mount(m);
    byId('wnow').innerHTML = covers.map((c) => `<option value="${c.id}">${coverLabel(m, c)}</option>`).join('');
    if (form) {
      restoreForm(form);
    } else {
      const start = new Date(now());
      start.setSeconds(0, 0);
      setDateTime('thrown', start.getTime());
      setWhenDays(DEFAULT_QUICK_DAYS);
    }
    syncCovers();
    wire();
    renderPieces();
    compute();
  }

  function wire(): void {
    root.querySelectorAll<HTMLButtonElement>('[data-lang]').forEach((b) => {
      b.onclick = () => switchLanguage(b.dataset.lang ?? '');
    });
    root.querySelectorAll<HTMLButtonElement>('[data-theme-choice]').forEach((b) => {
      b.onclick = () => switchTheme(b.dataset.themeChoice as ThemeChoice);
    });
    chips().forEach((c) => {
      c.onclick = () => {
        setWhenDays(+(c.dataset.d ?? NaN));
        compute();
      };
    });
    presets().forEach((b) => {
      b.onclick = () => {
        setThrownPreset(b.dataset.preset as ThrownPreset);
        compute();
      };
    });
    for (const id of DATE_IDS) {
      const button = byId<HTMLButtonElement>(`${id}-day-btn`);
      const dialog = byId<HTMLDialogElement>(`${id}-cal`);
      button.onclick = () => openCalendar(id);
      calendar(id).addEventListener('change', () => pickDay(id));
      // also fired when paging moves the focused day into another month
      calendar(id).addEventListener('focusday', (e) => showMonth(id, (e as CustomEvent<Date>).detail));
      // Escape closes the dialog natively; a click on the backdrop lands on the dialog element itself
      dialog.addEventListener('click', (e) => {
        if (e.target === dialog) dialog.close();
      });
      dialog.addEventListener('close', () => button.focus());
      const time = byId<HTMLInputElement>(`${id}-time`);
      time.addEventListener('input', () => checkTime(id, false));
      time.addEventListener('change', () => checkTime(id, true));
    }
    const night = byId<HTMLInputElement>('night');
    const syncNight = (): void => {
      root.querySelectorAll('.night').forEach((e) => {
        e.classList.toggle('hide', !night.checked);
      });
    };
    night.addEventListener('change', syncNight);
    syncNight();
    root.querySelectorAll<HTMLInputElement | HTMLSelectElement>('input,select').forEach((e) => {
      if (e.id === 'mnow' || e.id === 'wnow') {
        e.addEventListener('input', updateWeight);
        return;
      }
      e.addEventListener('input', () => {
        if (e.id.startsWith('when-')) press(chips(), () => false);
        if (e.id.startsWith('thrown-')) press(presets(), () => false);
        if (e.dataset.cover) syncCovers();
        compute();
      });
    });
  }

  // ---------- activity / welcome screen ----------
  const idleMs = deps.idleResetMs ?? DEFAULT_IDLE_RESET_MS;
  // kept in memory as well, so a page whose storage fails does not welcome on every return to the tab
  let lastActive = deps.activity.load();
  let lastSaved: number | null = null;

  function recordActivity(): void {
    const t = now();
    lastActive = t;
    if (lastSaved !== null && t - lastSaved < ACTIVITY_SAVE_MS) return;
    lastSaved = t;
    deps.activity.save(t);
  }

  function checkIdle(): void {
    if (!welcome.open && shouldWelcome(lastActive, now(), idleMs)) welcome.show();
  }

  // ---------- init ----------
  render(deps.messages, null);
  conditions.subscribe?.(compute);
  for (const type of ['input', 'change', 'click']) root.addEventListener(type, recordActivity);
  document.addEventListener('visibilitychange', () => {
    if (document.visibilityState === 'visible') checkIdle();
  });
  window.addEventListener('pageshow', checkIdle);
  checkIdle();
}
