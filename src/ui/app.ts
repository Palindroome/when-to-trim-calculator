// The page: its state (saved pieces, the plan to save, the language), the recalculation and the composition of the features.
import { explainCalculation } from '../domain/explain';
import { MS_PER_HOUR } from '../domain/params';
import { derivePiece } from '../domain/piece';
import { planDrying } from '../domain/planner';
import { simulate } from '../domain/simulate';
import { tipsFor } from '../domain/tips';
import { createFormatter, type Messages } from '../i18n';
import { calibrationSamples, type StoredPiece } from '../storage/pieces';
import type { SessionSnapshot } from '../storage/session';
import { perCoverCalibration } from './calibration';
import type { AppContext, AppDeps, Saveable } from './context';
import { byId } from './dom';
import { createSummaryCards, renderSummaries } from './features/cards/cards';
import * as conditionsSection from './features/conditions/conditions';
import * as coverFilter from './features/covers/covers';
import * as datetime from './features/datetime/datetime';
import * as explainer from './features/explainer/explainer';
import * as header from './features/header/header';
import * as pieceSection from './features/piece/piece';
import * as piecesSection from './features/pieces/pieces';
import * as result from './features/result/result';
import * as weight from './features/weight/weight';
import { createWelcome, shouldWelcome, trackActivity } from './features/welcome/welcome';
import { createWizard } from './features/wizard/wizard';
import { renderFooter } from './footer';
import { readAllowedCovers, readName, readPieceInput, readThrownMs, readWhenMs } from './form';
import { captureForm, type FormState, restoreForm } from './form-state';
import { slideIndicator, viewTransition } from './motion';
import type { View } from './render';
import { renderShell } from './shell';

export type { AppDeps } from './context';

/** Welcome screen again after this long without interaction. */
const DEFAULT_IDLE_RESET_MS = 60 * 60 * 1000;

/** Features with wiring, mounted on every freshly rendered shell. */
const FEATURES = [
  header,
  pieceSection,
  conditionsSection,
  datetime,
  coverFilter,
  result,
  weight,
  piecesSection,
  explainer,
];

export function startApp(deps: AppDeps): void {
  const { root, params, repository, conditions, rateModel } = deps;
  const covers = params.covers;
  const coverIds = covers.map((c) => c.id);
  let view: View;
  let theme = deps.theme;
  let pieces: StoredPiece[] = repository.load();
  let saveable: Saveable | null = null;

  const calibration = () => deps.calibrator(calibrationSamples(pieces), params);
  const ctx: AppContext = {
    get view() {
      return view;
    },
    now: deps.now ?? Date.now,
    weather: deps.weather,
    get pieces() {
      return pieces;
    },
    storePieces(next) {
      pieces = next;
      repository.save(pieces);
    },
    get saveable() {
      return saveable;
    },
    calibration,
    perCover: () => perCoverCalibration(calibration(), coverIds),
    context: (piece, startMs) => ({
      piece,
      conditions: conditions.read(),
      startMs,
      multipliers: calibration().multipliers(coverIds),
      model: rateModel,
      params,
      covers,
    }),
    compute,
    switchLanguage,
    setTheme(next) {
      theme = next;
      deps.onThemeChange(next);
    },
  };

  const cards = createSummaryCards(root, deps.wizard.load() === 'done');
  const wizard = createWizard(root, deps.wizard, (outcome) => cards.set(outcome === 'done'));
  const welcome = createWelcome(root, ctx, {
    onNew: () => {
      render(view.m, null);
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

  /** Recalculates the recommendation from the form, then the summaries and the weight check. */
  function compute(): void {
    const input = readPieceInput();
    const piece = derivePiece(input, params);
    const startMs = readThrownMs(ctx.now());
    const whenMs = readWhenMs();
    const dc = ctx.context(piece, startMs);
    const allowed = readAllowedCovers(covers);
    const plan = planDrying(dc, (whenMs - startMs) / MS_PER_HOUR, input.stage, { allowed });
    const rec = plan.recommendation;

    let window: { start: number; end: number } | undefined;
    if (rec.status === 'onTarget') {
      const [ws, we] = simulate(rec.option.plan, dc, [piece.softPct, piece.hardPct]) as [
        number,
        number,
      ];
      window = { start: ws, end: we };
      saveable = { piece, startMs, option: rec.option, ws, we };
    } else if (rec.status === 'invalidDeadline') {
      saveable = null;
    } else {
      saveable = { piece, startMs, option: rec.option, ws: NaN, we: NaN };
    }

    const tips = tipsFor(rec, piece, dc.conditions, params, covers);
    const calibration = ctx.perCover();
    result.update(view, {
      piece,
      startMs,
      plan,
      window,
      tips,
      calibration,
      canSave: saveable !== null,
      allowed,
    });
    explainer.update(view, explainCalculation(input, dc, plan, allowed), calibration);
    cards.update(
      renderSummaries(view, {
        name: readName(),
        piece: input,
        conditions: dc.conditions,
        thrownMs: startMs,
        whenMs,
      }),
    );
    weight.update(ctx);
  }

  function switchLanguage(code: string): void {
    const next = deps.locales[code];
    if (!next) return;
    deps.onLocaleChange(code);
    if (next === view.m) return;
    const from = root.querySelector('[data-lang][aria-pressed="true"]')?.getBoundingClientRect();
    const explainerOpen = explainer.isOpen(root);
    const scrollY = window.scrollY;
    // the page cross-fades into the new language and the switch's highlight slides to the chosen button
    viewTransition(() => {
      render(next, captureForm(root, covers));
      if (explainerOpen) explainer.open(root);
      window.scrollTo(0, scrollY);
      const button = root.querySelector<HTMLElement>(`[data-lang="${code}"]`);
      // the scroll position stays where the reader was
      button?.focus({ preventScroll: true });
      if (button) slideIndicator(button.parentElement!, from, button);
    });
  }

  /** (Re)builds the page in `messages`; `form` restores the inputs after a language switch. */
  function render(messages: Messages, form: FormState | null): void {
    const m = messages;
    view = { m, params, fmt: createFormatter(m, params.horizonHours / 24), covers };
    document.documentElement.lang = m.lang;
    document.title = m.title;
    root.innerHTML = renderShell(
      m,
      Object.keys(deps.locales),
      theme ?? 'system',
      covers,
      deps.weather !== undefined,
    );
    if (deps.footer) deps.footer.innerHTML = renderFooter(m);
    wizard.mount(m);
    cards.mount(m);
    welcome.mount(m);
    if (form) restoreForm(root, ctx, form);
    else datetime.reset(root, ctx);
    for (const feature of FEATURES) feature.mount(root, ctx);
    piecesSection.render(ctx);
    compute();
  }

  /** Brings back the page as it was left in this tab; false when the snapshot cannot be applied. */
  function resume(s: SessionSnapshot): boolean {
    try {
      render(deps.messages, s.form);
      wizard.resume(s.wizardStep);
      if (s.screen === 'welcome') welcome.show(s.piecesListed);
      window.scrollTo(0, s.scrollY);
      return true;
    } catch {
      // e.g. a snapshot from an older version of the page, with fields that no longer exist
      return false;
    }
  }

  function saveSession(): void {
    deps.session.save({
      screen: welcome.open ? 'welcome' : 'calculator',
      piecesListed: welcome.listed,
      form: captureForm(root, covers),
      wizardStep: wizard.step,
      scrollY: window.scrollY,
    });
  }

  const idleMs = deps.idleResetMs ?? DEFAULT_IDLE_RESET_MS;
  const idle = shouldWelcome(deps.activity.load(), ctx.now(), idleMs);
  const snapshot = idle ? null : deps.session.load();
  if (!snapshot || !resume(snapshot)) render(deps.messages, null);
  conditions.subscribe?.(compute);
  trackActivity(root, welcome, deps.activity, ctx.now, idleMs);
  for (const type of ['input', 'change', 'click']) root.addEventListener(type, saveSession);
  window.addEventListener('pagehide', saveSession);
}
