// "How it calculates": the calculation of the current recommendation as numbered steps, folded by default.
import type { CoverCalibration } from '../../../domain/calibration';
import { type CoverId, coverById } from '../../../domain/covers';
import type { CalculationTrace, CoverTrace } from '../../../domain/explain';
import { MS_PER_HOUR } from '../../../domain/params';
import { type Climate, MAGNUS } from '../../../domain/physics';
import type { Messages } from '../../../i18n';
import type { AppContext } from '../../context';
import { byId, esc } from '../../dom';
import { icon } from '../../icons';
import { captureSlides, slideNumbers, stagger } from '../../motion';
import { formatNum } from '../../numbers';
import { coverLabel, type View } from '../../render';

export function markup(m: Messages): string {
  const e = m.explainer;
  return `<section class="card explainer">
    <details>
      <summary>${icon('info')}${e.summary}</summary>
      <p class="intro">${e.intro}</p>
      <ol class="steps" role="list" id="explain-steps"></ol>
      ${e.notes.map((n) => `<p class="note">${n}</p>`).join('\n      ')}
    </details>
  </section>`;
}

// Sentences come from the catalog (trusted); labels are escaped where they are passed in, and every
// number is a sliding-number span (`data-slide`, keyed by its place in the steps).
const step = (key: string, title: string, lines: string[]): string =>
  `<li data-explain="${key}"><h3>${esc(title)}</h3>${lines.join('')}</li>`;
const text = (s: string): string => `<p>${s}</p>`;
const formula = (s: string): string => `<p class="formula">${s}</p>`;
const rows = (items: string[]): string =>
  `<ul class="rows">${items.map((s) => `<li class="formula">${s}</li>`).join('')}</ul>`;
/** the step's formula as in the model code, and what its symbols stand for */
const code = (f: string, symbols?: string): string =>
  `<p class="desc"><code>${esc(f)}</code>${symbols ? ` <span class="symbols">${esc(symbols)}</span>` : ''}</p>`;

/** The steps for `t`; `calibration` gives the number of rated pieces behind each multiplier. */
export function renderSteps(
  v: View,
  t: CalculationTrace,
  calibration: Record<CoverId, CoverCalibration>,
): string {
  const { m, fmt, params: p } = v;
  const e = m.explainer;
  const f = e.formula;
  // keys of the sliding numbers: a scope per step or row, then the number's position in it
  let scope = '';
  let index = 0;
  const at = (key: string): void => {
    scope = key;
    index = 0;
  };
  const slide = (s: string): string =>
    `<span class="slide" data-slide="${scope}-${index++}">${s}</span>`;
  /** at most `digits` decimals, trailing zeros dropped */
  const dec = (x: number, digits: number): string =>
    digits ? fmt.decimal(x, digits).replace(/0+$/, '').replace(/\D$/, '') : fmt.decimal(x, 0);
  const n = (x: number, digits: number): string => slide(dec(x, digits));
  const dur = (h: number): string => slide(fmt.duration(h));
  /** g/h: slow covers in humid air get a third decimal instead of rounding to 0 */
  const gPerHour = (x: number): string => n(x, x < 0.1 ? 3 : 2);
  const signed = (x: number): string => (x < 0 ? `− ${n(-x, 1)}` : `+ ${n(x, 1)}`);
  const label = (id: CoverId): string => esc(coverLabel(m, coverById(v.covers, id)));
  const link = (term: { label: string; href: string }): string =>
    `<a href="${esc(term.href)}" target="_blank" rel="noopener noreferrer">${esc(term.label)}<span class="vh"> ${esc(e.terms.newTab)}</span></a>`;
  const excludedMark = (row: string, c: CoverTrace): string =>
    c.excluded ? `${row} · ${esc(m.result.excludedBar)}` : row;
  const { input, piece } = t;
  const night = { from: String(p.night.fromHour), to: String(p.night.toHour) };
  const out: string[] = [];

  // 1. inputs, after the clamps, and the clay body's values
  at('inputs');
  const clamps: string[] = [];
  if (input.massG < p.piece.minMassG) clamps.push(e.inputs.massClamped(n(p.piece.minMassG, 1)));
  if (input.wallMm < p.piece.minWallMm) clamps.push(e.inputs.wallClamped(n(p.piece.minWallMm, 1)));
  if (input.baseMm === undefined) clamps.push(e.inputs.baseFromWall);
  else if (input.baseMm < p.piece.minBaseMm)
    clamps.push(e.inputs.baseClamped(n(p.piece.minBaseMm, 1)));
  out.push(
    step('inputs', e.inputs.title, [
      code(f.inputs, f.inputsSymbols),
      text(e.inputs.values(n(piece.mass, 1), n(piece.wall, 1), n(piece.base, 1))),
      text(
        e.inputs.material(
          esc(m.options.clay[input.clay]),
          n(p.clayDensity, 2),
          n(piece.claySlow, 2),
          n(piece.clayLossPct, 1),
        ),
      ),
      ...clamps.map(text),
    ]),
  );

  // 2. exposed surface
  at('surface');
  out.push(
    step('surface', e.surface.title, [
      text(e.surface.text),
      code(f.surface, f.surfaceSymbols),
      formula(
        e.surface.sheet(
          n(piece.mass, 1),
          n(p.clayDensity, 2),
          n(piece.wall / 10, 2),
          n(piece.sideArea, 0),
        ),
      ),
      formula(
        e.surface.area(
          n(piece.sideArea, 0),
          n(piece.areaFactor, 2),
          esc(m.options.shape[input.shape]),
          n(piece.area, 4),
        ),
      ),
    ]),
  );

  // 3. slowness
  at('slowness');
  out.push(
    step('slowness', e.slowness.title, [
      text(e.slowness.text),
      code(f.slowness, f.slownessSymbols),
      formula(
        e.slowness.thick(
          n(piece.base, 1),
          n(piece.wall, 1),
          n(p.baseThicknessExponent, 2),
          n(piece.thick, 2),
        ),
      ),
      formula(
        e.slowness.product(
          n(piece.shapeSlow, 2),
          n(piece.claySlow, 2),
          n(piece.batSlow, 2),
          n(piece.thick, 2),
          n(piece.slow, 2),
        ),
      ),
    ]),
  );

  // 4. target loss and window
  at('target');
  out.push(
    step('target', e.target.title, [
      text(e.target.text(esc(m.options.stage[input.stage]))),
      code(f.target, f.targetSymbols),
      formula(
        e.target.loss(
          n(piece.clayLossPct, 1),
          signed(piece.wetnessPct),
          signed(piece.stagePct),
          n(piece.lossPct, 1),
          n(t.grams.target, 0),
        ),
      ),
      formula(
        e.target.window(
          n(piece.softPct, 1),
          n(t.grams.soft, 0),
          n(piece.hardPct, 1),
          n(t.grams.hard, 0),
        ),
      ),
    ]),
  );

  // 5. drying power of the air
  const vpd = (key: string, where: string, c: Climate): string => {
    at(key);
    return (
      e.air.vpd(where, n(c.temp, 1), n(c.rh, 1), n(c.psat, 1), n(c.rhUsed, 1), n(c.vpd, 2)) +
      (c.vpd === p.minVpd ? e.air.floor(n(p.minVpd, 2)) : '')
    );
  };
  const climates = [vpd('air-start', e.air.start, t.air.start)];
  if (t.air.night) climates.push(vpd('air-night', e.air.night(night.from, night.to), t.air.night));
  if (v.covers.some((c) => c.environment === 'dampRoom'))
    climates.push(vpd('air-damp', e.air.damp, t.air.damp));
  at('air');
  out.push(
    step('air', e.air.title, [
      text(
        e.air.text(link(e.terms.vpd), link(e.terms.psat), link(e.terms.magnus), link(e.terms.rh)),
      ),
      code(f.psat(dec(MAGNUS.a, 3), dec(MAGNUS.b, 2), dec(MAGNUS.c, 2))),
      code(f.vpd, f.airSymbols),
      rows(climates),
      text(e.air.airflow(esc(m.options.airflow[t.air.airflow]), n(t.air.airflowFactor, 2))),
    ]),
  );

  // 6. rate per cover, at the throwing time
  const rateRows = t.covers.map((c) => {
    at(`rate-${c.cover}`);
    const def = coverById(v.covers, c.cover);
    const vpdUsed = def.environment === 'dampRoom' ? t.air.damp.vpd : t.air.start.vpd;
    const row =
      t.physical && c.air !== undefined && c.factor !== undefined
        ? e.rate.row(
            label(c.cover),
            n(p.evaporationCoefficient, 2),
            n(piece.area, 4),
            n(vpdUsed, 2),
            n(c.air, 2),
            n(c.factor, 2),
            n(piece.slow, 2),
            n(c.multiplier, 2),
            gPerHour(c.rate),
          )
        : e.rate.modelRow(label(c.cover), gPerHour(c.rate));
    const samples = calibration[c.cover]?.samples ?? 0;
    return excludedMark(samples ? `${row} · ${e.rate.calibrated(samples)}` : row, c);
  });
  at('rate-night');
  const nightRates = t.covers
    .filter((c) => c.nightRate !== undefined)
    .map((c) => e.rate.nightRate(label(c.cover), gPerHour(c.nightRate!)));
  out.push(
    step('rate', e.rate.title, [
      text(t.physical ? e.rate.text : e.rate.modelText),
      ...(t.physical ? [code(f.rate, f.rateSymbols)] : []),
      rows(rateRows),
      ...(nightRates.length
        ? [text(e.rate.night(night.from, night.to, nightRates.join(', ')))]
        : []),
    ]),
  );

  // 7. time to the target per cover, the same hours as the comparison bars
  at('time');
  const timeText = e.time.text(link(e.terms.euler), dur(p.stepHours), n(t.grams.target, 0));
  const timeRows = t.covers.map((c) => {
    at(`time-${c.cover}`);
    return excludedMark(e.time.row(label(c.cover), dur(c.hours)), c);
  });
  out.push(
    step('time', e.time.title, [
      text(timeText),
      code(f.time, f.timeSymbols),
      ...(t.air.night ? [text(e.time.night)] : []),
      rows(timeRows),
    ]),
  );

  // 8. choosing the plan
  at('plan');
  const rec = t.plan.recommendation;
  const H = t.plan.deadlineHours;
  const tol = n(p.planner.targetTolerance * 100, 1);
  const planLines: string[] = [];
  if (rec.status === 'invalidDeadline') {
    planLines.push(text(esc(m.errors.invalidDeadline)));
  } else {
    planLines.push(code(f.plan, f.planSymbols));
    planLines.push(text(e.plan.deadline(dur(H))));
    const names = (cs: CoverTrace[]): string => cs.map((c) => label(c.cover)).join(', ');
    const excluded = t.covers.filter((c) => c.excluded);
    if (excluded.length) planLines.push(text(e.plan.excluded(names(excluded))));
    // gated covers the user left ticked: why they were or were not planned with
    const gated = t.covers.filter(
      (c) => !c.excluded && coverById(v.covers, c.cover).gate === 'longWaitOrSoft',
    );
    const gate = (
      cs: CoverTrace[],
      sentence: (covers: string, soft: string, min: string) => string,
    ): void => {
      if (cs.length)
        planLines.push(
          text(sentence(names(cs), esc(m.options.stage.soft), dur(p.planner.dampMinHours))),
        );
    };
    if (t.gateOpen) gate(gated, e.plan.gateOpen);
    else {
      gate(
        gated.filter((c) => !c.considered),
        e.plan.gateClosed,
      );
      gate(
        gated.filter((c) => c.considered),
        e.plan.gateOnlyChoice,
      );
    }
    if (rec.status === 'tooFast')
      planLines.push(text(e.plan.tooFast(dur(rec.fastestHours), dur(H))));
    else if (rec.status === 'tooSlow')
      planLines.push(text(e.plan.tooSlow(dur(rec.slowestHours), dur(H))));
    else if (rec.option.kind === 'single')
      planLines.push(
        text(
          e.plan.single(
            label(rec.option.cover),
            dur(rec.option.hours),
            dur(H),
            n((Math.abs(rec.option.hours - H) / H) * 100, 1),
            tol,
          ),
        ),
      );
    else
      planLines.push(
        text(
          e.plan.twoPhase(
            tol,
            label(rec.option.first),
            dur(rec.option.switchAfterHours),
            label(rec.option.then),
            link(e.terms.bisection),
          ),
        ),
      );
  }
  out.push(step('plan', e.plan.title, planLines));

  // 9. result, worded exactly as in the recommendation
  if (rec.status !== 'invalidDeadline') {
    at('result');
    const when = (hours: number): string => slide(fmt.dateTime(t.startMs + hours * MS_PER_HOUR));
    const r = t.result;
    out.push(
      step(
        'result',
        e.result.title,
        r
          ? [
              code(f.result),
              text(
                m.result.ready(
                  when(r.ready),
                  slide(formatNum(fmt, { kind: 'decimal', value: piece.lossPct, digits: 1 })),
                  slide(formatNum(fmt, { kind: 'int', value: t.grams.target })),
                ),
              ),
              text(
                m.result.window(
                  when(r.windowStart),
                  Number.isFinite(r.windowEnd) ? when(r.windowEnd) : m.result.windowOpenEnd,
                ),
              ),
            ]
          : [text(e.result.none)],
      ),
    );
  }
  return out.join('');
}

/**
 * Re-renders only the steps, so an open <details> and the scroll position stay as they are; changed
 * numbers slide to their new value.
 */
export function update(
  v: View,
  t: CalculationTrace,
  calibration: Record<CoverId, CoverCalibration>,
): void {
  const el = byId('explain-steps');
  const before = captureSlides(el);
  el.innerHTML = renderSteps(v, t, calibration);
  slideNumbers(el, before);
}

const detailsOf = (root: HTMLElement): HTMLDetailsElement =>
  root.querySelector<HTMLDetailsElement>('.explainer details')!;

/** Whether the section is open, to keep it open across a language switch. */
export const isOpen = (root: HTMLElement): boolean => detailsOf(root).open;

/** Opens the section without its reveal (after a language switch). */
export function open(root: HTMLElement): void {
  detailsOf(root).open = true;
}

/** Opening the section by the user (click or keyboard on the summary) reveals its steps one after another. */
export function mount(root: HTMLElement, _ctx: AppContext): void {
  const details = detailsOf(root);
  details.querySelector('summary')!.addEventListener('click', () => {
    // the click comes before the toggle: closed now means it is opening
    if (!details.open) stagger(details.querySelectorAll<HTMLElement>('#explain-steps > li'));
  });
}
