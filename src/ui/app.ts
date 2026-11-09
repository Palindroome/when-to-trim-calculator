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
import { byId } from './dom';
import { readName, readPieceInput, readThrownMs, readWeightInputs, readWhenMs, toLocalInput } from './form';
import { renderCalibration, renderPieceList, renderResult, renderWeight, planText, type View } from './render';
import { renderShell } from './shell';

export interface AppDeps {
  root: HTMLElement;
  /** initial language */
  messages: Messages;
  /** languages offered by the switch, by locale code */
  locales: Readonly<Record<string, Messages>>;
  /** called with the locale code when the user picks a language */
  onLocaleChange: (code: string) => void;
  params: ModelParams;
  repository: PieceRepository;
  conditions: ConditionsSource;
  rateModel: RateModel;
  calibrator: CalibratorFactory;
  now?: () => number;
}

/** Default trim date offered on load: thrown + 2 days, at 10:00. */
const DEFAULT_QUICK_DAYS = 2;
const QUICK_DATE_HOUR = 10;

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

  // ---------- render ----------
  /** (Re)builds the page in `messages`; `form` restores the inputs after a language switch. */
  function render(messages: Messages, form: FormState | null): void {
    m = messages;
    view = { m, params, fmt: createFormatter(m, params.horizonHours / 24) };
    document.documentElement.lang = m.lang;
    document.title = m.title;
    root.innerHTML = renderShell(m, Object.keys(deps.locales));
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

  // ---------- init ----------
  render(deps.messages, null);
  conditions.subscribe?.(compute);
}
