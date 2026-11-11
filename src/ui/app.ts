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
import type { ActivityStore } from '../storage/activity';
import type { Theme } from '../storage/preferences';
import type { WizardStore } from '../storage/wizard';
import { byId } from './dom';
import { renderFooter } from './footer';
import { readName, readPieceInput, readThrownMs, readWeightInputs, readWhenMs, toLocalInput } from './form';
import {
  renderCalibration,
  renderSummaries,
  renderPieceList,
  renderResult,
  renderWeight,
  renderWelcomePieces,
  planText,
  type View,
} from './render';
import { renderShell, type ThemeChoice } from './shell';
import { createSummaryCards } from './cards';
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
    const s = new Date(byId<HTMLInputElement>('thrown').value || now());
    const t = new Date(s.getTime());
    t.setDate(t.getDate() + days);
    t.setHours(QUICK_DATE_HOUR, 0, 0, 0);
    byId<HTMLInputElement>('when').value = toLocalInput(t);
    chips().forEach((c) => c.classList.toggle('on', +(c.dataset.d ?? NaN) === days));
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
    };
  }

  function restoreForm(s: FormState): void {
    for (const f of s.fields) {
      const e = byId<HTMLInputElement | HTMLSelectElement>(f.id);
      e.value = f.value;
      if (e instanceof HTMLInputElement && e.type === 'checkbox') e.checked = f.checked;
    }
    chips().forEach((c) => c.classList.toggle('on', c.dataset.d === s.quick));
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
    welcome.mount(m);
    byId('wnow').innerHTML = COVERS.map((c) => `<option value="${c}">${m.covers.label[c]}</option>`).join('');
    if (form) {
      restoreForm(form);
    } else {
      const start = new Date(now());
      start.setSeconds(0, 0);
      byId<HTMLInputElement>('thrown').value = toLocalInput(start);
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
        if (e.id === 'when') chips().forEach((c) => c.classList.remove('on'));
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
