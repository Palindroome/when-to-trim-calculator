import type { CalibratorFactory } from '../domain/calibration';
import { feedbackToSample } from '../domain/calibration';
import type { ConditionsSource } from '../domain/conditions';
import { MS_PER_HOUR, type ModelParams } from '../domain/params';
import type { RateModel } from '../domain/physics';
import { derivePiece } from '../domain/piece';
import { dominantCover, planDrying, type PlanOption } from '../domain/planner';
import { simulate, type DryingContext } from '../domain/simulate';
import { tipsFor } from '../domain/tips';
import { COVERS, type Cover, type FeedbackKind, type Piece } from '../domain/types';
import { assessWeight } from '../domain/weight';
import { createFormatter, type Messages } from '../i18n';
import { calibrationSamples, type PieceRepository, type StoredPiece } from '../storage/pieces';
import type { Theme } from '../storage/preferences';
import type { WizardStore } from '../storage/wizard';
import { byId } from './dom';
import { renderFooter } from './footer';
import {
  dayOptions,
  normalizeTime,
  OTHER_DAY,
  readName,
  readPieceInput,
  readThrownMs,
  readWeightInputs,
  readWhenMs,
  toDayKey,
  toTime,
  type DateTimeId,
} from './form';
import { renderCalibration, renderSummaries, renderPieceList, renderResult, renderWeight, planText, type View } from './render';
import { renderShell, type ThemeChoice, type ThrownPreset } from './shell';
import { createSummaryCards } from './cards';
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
  conditions: ConditionsSource;
  rateModel: RateModel;
  calibrator: CalibratorFactory;
  now?: () => number;
}

/** Default trim date offered on load: thrown + 2 days, at 10:00. */
const DEFAULT_QUICK_DAYS = 2;
const QUICK_DATE_HOUR = 10;
/** Thrown presets "dziś rano" (today) and "wczoraj wieczorem" (yesterday). */
const MORNING_HOUR = 8;
const EVENING_HOUR = 19;
/** Day options for the throwing time: the last 14 days up to today. */
const THROWN_PAST_DAYS = 13;
const DATE_IDS: readonly DateTimeId[] = ['thrown', 'when'];

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
}

export function startApp(deps: AppDeps): void {
  const { root, params, repository, conditions, rateModel } = deps;
  const now = deps.now ?? Date.now;
  let m: Messages;
  let view: View;

  let pieces: StoredPiece[] = repository.load();
  let saveable: Saveable | null = null;

  const calibration = () => deps.calibrator(calibrationSamples(pieces), params);

  const cards = createSummaryCards(root, deps.wizard.load() === 'done');
  const wizard = createWizard(root, deps.wizard, (outcome) => cards.set(outcome === 'done'));

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
    return { piece, conditions: conditions.read(), startMs, multipliers: calibration().multipliers(), model: rateModel, params };
  }

  // ---------- recommendation ----------
  function compute(): void {
    const input = readPieceInput();
    const piece = derivePiece(input, params);
    const startMs = readThrownMs(now());
    const H = (readWhenMs() - startMs) / MS_PER_HOUR;
    const ctx = context(piece, startMs);
    const plan = planDrying(ctx, H, input.stage);
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

    const cal = calibration();
    const perCover = {} as Record<Cover, ReturnType<typeof cal.estimate>>;
    for (const c of COVERS) perCover[c] = cal.estimate(c);

    const result = byId('result');
    result.innerHTML = renderResult(view, {
      piece,
      startMs,
      plan,
      window,
      tips: tipsFor(rec, piece, ctx.conditions, params),
      calibration: perCover,
      canSave: saveable !== null,
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
      plan: option.plan.map((s) => ({ w: s.cover, h: isFinite(s.hours) ? s.hours : null })),
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
    const cal = calibration();
    const perCover = {} as Record<Cover, ReturnType<typeof cal.estimate>>;
    for (const c of COVERS) perCover[c] = cal.estimate(c);
    byId('calib').innerHTML = renderCalibration(view, perCover);
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

  /** Puts a time into a picker; a day outside the option list goes to the "other date" input. */
  function setDateTime(id: DateTimeId, ms: number): void {
    const d = new Date(ms);
    const day = byId<HTMLSelectElement>(`${id}-day`);
    day.value = toDayKey(d);
    if (!day.value) day.value = OTHER_DAY;
    byId<HTMLInputElement>(`${id}-date`).value = toDayKey(d);
    byId<HTMLInputElement>(`${id}-time`).value = toTime(d);
    syncDay(id);
    checkTime(id, true);
  }

  /** Shows the native date input only while "other date" is chosen. */
  function syncDay(id: DateTimeId): void {
    byId(`${id}-date`).classList.toggle('hide', byId<HTMLSelectElement>(`${id}-day`).value !== OTHER_DAY);
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

  /** Fills the day selects: thrown from 13 days ago to today, trim from yesterday to the model horizon. */
  function fillDays(): void {
    const html = (from: number, to: number): string =>
      dayOptions(m, view.fmt, now(), from, to)
        .map((o) => `<option value="${o.value}">${o.label}</option>`)
        .concat(`<option value="${OTHER_DAY}">${m.dateTime.otherDay}</option>`)
        .join('');
    byId('thrown-day').innerHTML = html(-THROWN_PAST_DAYS, 0);
    byId('when-day').innerHTML = html(-1, params.horizonHours / 24);
  }

  // ---------- language ----------
  function captureForm(): FormState {
    return {
      fields: [...root.querySelectorAll<HTMLInputElement | HTMLSelectElement>('input,select')].map((e) => ({
        id: e.id,
        value: e.value,
        checked: e instanceof HTMLInputElement && e.checked,
      })),
      quick: root.querySelector<HTMLElement>('#quick .chip.on')?.dataset.d,
      thrownPreset: root.querySelector<HTMLElement>('#thrown-quick .chip.on')?.dataset.preset,
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
      syncDay(id);
      checkTime(id, true);
    }
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
    view = { m, params, fmt: createFormatter(m, params.horizonHours / 24) };
    document.documentElement.lang = m.lang;
    document.title = m.title;
    root.innerHTML = renderShell(m, Object.keys(deps.locales), theme ?? 'system');
    if (deps.footer) deps.footer.innerHTML = renderFooter(m);
    wizard.mount(m);
    cards.mount(m);
    byId('wnow').innerHTML = COVERS.map((c) => `<option value="${c}">${m.covers.label[c]}</option>`).join('');
    fillDays();
    if (form) {
      restoreForm(form);
    } else {
      const start = new Date(now());
      start.setSeconds(0, 0);
      setDateTime('thrown', start.getTime());
      setWhenDays(DEFAULT_QUICK_DAYS);
    }
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
      const day = byId<HTMLSelectElement>(`${id}-day`);
      day.addEventListener('input', () => {
        // keep the date input on the chosen day, so "other date" starts from it
        if (day.value !== OTHER_DAY) byId<HTMLInputElement>(`${id}-date`).value = day.value;
        syncDay(id);
      });
      const time = byId<HTMLInputElement>(`${id}-time`);
      time.addEventListener('input', () => checkTime(id, false));
      time.addEventListener('change', () => checkTime(id, true));
    }
    const night = byId<HTMLInputElement>('night');
    const syncNight = (): void => {
      root.querySelectorAll('.night').forEach((e) => e.classList.toggle('hide', !night.checked));
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
        compute();
      });
    });
  }

  // ---------- init ----------
  render(deps.messages, null);
  conditions.subscribe?.(compute);
}
