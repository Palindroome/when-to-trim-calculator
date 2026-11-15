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

/** Id of the one bubble that shows the label of whichever number is hovered, focused or tapped. */
const TIP_ID = 'explain-tip';

type NumId = keyof Messages['explainer']['labels'];

/** Id of the hidden element that holds a label: every number of that kind is described by it. */
const labelId = (id: NumId): string => `explain-label-${id}`;

export function markup(m: Messages): string {
  const e = m.explainer;
  const labels = (Object.keys(e.labels) as NumId[])
    .map((id) => `<span id="${labelId(id)}">${esc(e.labels[id])}</span>`)
    .join('');
  // the bubble is only the visual copy of a label; screen readers get it from the hidden labels
  return `<section class="card explainer">
    <details>
      <summary>${icon('info')}${e.summary}</summary>
      <p class="intro">${e.intro}</p>
      <ol class="steps" role="list" id="explain-steps"></ol>
      ${e.notes.map((n) => `<p class="note">${n}</p>`).join('\n      ')}
    </details>
    <div hidden>${labels}</div>
    <div class="tip-bubble" id="${TIP_ID}" aria-hidden="true" hidden></div>
  </section>`;
}

// Sentences come from the catalog (trusted); labels are escaped where they are passed in.
const step = (key: string, title: string, lines: string[]): string =>
  `<li data-explain="${key}"><h3>${esc(title)}</h3>${lines.join('')}</li>`;
const text = (s: string): string => `<p>${s}</p>`;
const formula = (s: string): string => `<p class="formula">${s}</p>`;
const rows = (items: string[]): string =>
  `<ul class="rows">${items.map((s) => `<li class="formula">${s}</li>`).join('')}</ul>`;
/** the step's formula as in the model code, and what its symbols stand for */
const code = (f: string, symbols?: string): string =>
  `<p class="desc"><code>${f}</code>${symbols ? ` <span class="symbols">${symbols}</span>` : ''}</p>`;

/** The steps for `t`; `calibration` gives the number of rated pieces behind each multiplier. */
export function renderSteps(
  v: View,
  t: CalculationTrace,
  calibration: Record<CoverId, CoverCalibration>,
): string {
  const { m, fmt, params: p } = v;
  const e = m.explainer;
  const f = e.formula;
  // Every number is focusable and described by its label (the tooltip), and slides when it changes. Its
  // slide key is the scope (a step or a row) plus what the number is, so only a value that really
  // changed rolls; a repeated number in the same scope gets a running suffix.
  let scope = '';
  const seen = new Map<string, number>();
  const at = (key: string): void => {
    scope = key;
  };
  const num = (id: NumId, s: string): string => {
    const key = `${scope}-${id}`;
    const i = seen.get(key) ?? 0;
    seen.set(key, i + 1);
    return `<span class="num-tip" tabindex="0" data-tip="${esc(e.labels[id])}" aria-describedby="${labelId(id)}"><span class="slide" data-slide="${key}-${i}">${s}</span></span>`;
  };
  /** at most `digits` decimals, trailing zeros dropped */
  const dec = (x: number, digits: number): string =>
    digits ? fmt.decimal(x, digits).replace(/0+$/, '').replace(/\D$/, '') : fmt.decimal(x, 0);
  const n = (id: NumId, x: number, digits: number): string => num(id, dec(x, digits));
  const dur = (id: NumId, h: number): string => num(id, fmt.duration(h));
  /** g/h: slow covers in humid air get a third decimal instead of rounding to 0 */
  const gPerHour = (id: NumId, x: number): string => n(id, x, x < 0.1 ? 3 : 2);
  const signed = (id: NumId, x: number): string =>
    x < 0 ? `− ${n(id, -x, 1)}` : `+ ${n(id, x, 1)}`;
  const label = (id: CoverId): string => esc(coverLabel(m, coverById(v.covers, id)));
  const link = (term: { label: string; href: string }): string =>
    `<a href="${esc(term.href)}" target="_blank" rel="noopener noreferrer">${esc(term.label)}<span class="vh"> ${esc(e.terms.newTab)}</span></a>`;
  const excludedMark = (line: string, c: CoverTrace): string =>
    c.excluded ? `${line} · ${esc(m.result.excludedBar)}` : line;
  const { input, piece } = t;
  /** the night hours, as numbers with their labels */
  const nightFrom = (): string => num('nightFrom', String(p.night.fromHour));
  const nightTo = (): string => num('nightTo', String(p.night.toHour));
  /** the "1" of a formula, explained like any other number */
  const one = (id: NumId): string => num(id, dec(1, 0));
  const out: string[] = [];

  // 1. inputs, after the clamps, and the clay body's values
  at('inputs');
  const clamps: string[] = [];
  if (input.massG < p.piece.minMassG)
    clamps.push(e.inputs.massClamped(n('minMass', p.piece.minMassG, 1)));
  if (input.wallMm < p.piece.minWallMm)
    clamps.push(e.inputs.wallClamped(n('minWall', p.piece.minWallMm, 1)));
  if (input.baseMm === undefined) clamps.push(e.inputs.baseFromWall);
  else if (input.baseMm < p.piece.minBaseMm)
    clamps.push(e.inputs.baseClamped(n('minBase', p.piece.minBaseMm, 1)));
  out.push(
    step('inputs', e.inputs.title, [
      code(f.inputs, f.inputsSymbols),
      text(
        e.inputs.values(
          n('mass', piece.mass, 1),
          n('wall', piece.wall, 1),
          n('base', piece.base, 1),
        ),
      ),
      text(
        e.inputs.material(
          esc(m.options.clay[input.clay]),
          n('density', p.clayDensity, 2),
          n('claySlow', piece.claySlow, 2),
          n('clayLoss', piece.clayLossPct, 1),
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
          n('mass', piece.mass, 1),
          n('density', p.clayDensity, 2),
          n('wallCm', piece.wall / 10, 2),
          n('sideArea', piece.sideArea, 0),
        ),
      ),
      formula(
        e.surface.area(
          n('sideArea', piece.sideArea, 0),
          n('areaFactor', piece.areaFactor, 2),
          esc(m.options.shape[input.shape]),
          n('area', piece.area, 4),
        ),
      ),
    ]),
  );

  // 3. slowness
  at('slowness');
  out.push(
    step('slowness', e.slowness.title, [
      text(e.slowness.text(one('neutral'))),
      code(f.slowness, f.slownessSymbols),
      formula(
        e.slowness.thick(
          n('base', piece.base, 1),
          n('wall', piece.wall, 1),
          n('thickExponent', p.baseThicknessExponent, 2),
          n('thick', piece.thick, 2),
          one('thickFloor'),
        ),
      ),
      formula(
        e.slowness.product(
          n('shapeSlow', piece.shapeSlow, 2),
          n('claySlow', piece.claySlow, 2),
          n('batSlow', piece.batSlow, 2),
          n('thick', piece.thick, 2),
          n('slow', piece.slow, 2),
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
          n('clayLoss', piece.clayLossPct, 1),
          signed('wetness', piece.wetnessPct),
          signed('stage', piece.stagePct),
          n('loss', piece.lossPct, 1),
          n('targetGrams', t.grams.target, 0),
        ),
      ),
      formula(
        e.target.window(
          n('softPct', piece.softPct, 1),
          n('softGrams', t.grams.soft, 0),
          n('hardPct', piece.hardPct, 1),
          n('hardGrams', t.grams.hard, 0),
        ),
      ),
    ]),
  );

  // 5. drying power of the air
  const vpd = (key: string, where: string, c: Climate): string => {
    at(key);
    return (
      e.air.vpd(
        where,
        n('temp', c.temp, 1),
        n('rh', c.rh, 1),
        n('psat', c.psat, 1),
        one('whole'),
        n('rhUsed', c.rhUsed, 1),
        n('vpd', c.vpd, 2),
      ) + (c.vpd === p.minVpd ? e.air.floor(n('minVpd', p.minVpd, 2)) : '')
    );
  };
  const climates = [vpd('air-start', e.air.start, t.air.start)];
  if (t.air.night) {
    at('air-night');
    climates.push(vpd('air-night', e.air.night(nightFrom(), nightTo()), t.air.night));
  }
  if (v.covers.some((c) => c.environment === 'dampRoom'))
    climates.push(vpd('air-damp', e.air.damp, t.air.damp));
  at('air');
  out.push(
    step('air', e.air.title, [
      text(
        e.air.text(
          link(e.terms.vpd),
          link(e.terms.psat),
          link(e.terms.magnus),
          link(e.terms.rh),
          one('whole'),
        ),
      ),
      code(f.psat(n('magnusA', MAGNUS.a, 3), n('magnusB', MAGNUS.b, 2), n('magnusC', MAGNUS.c, 2))),
      code(
        f.vpd,
        f.airSymbols(
          n('minVpd', p.minVpd, 2),
          n('rhMin', p.rhClamp.min, 1),
          n('rhMax', p.rhClamp.max, 1),
        ),
      ),
      rows(climates),
      text(
        e.air.airflow(
          esc(m.options.airflow[t.air.airflow]),
          n('airflowFactor', t.air.airflowFactor, 2),
          one('sealedAir'),
        ),
      ),
    ]),
  );

  // 6. rate per cover, at the throwing time: first what the cover contributes (its calibration first),
  // then the rate that uses it
  const rateRows = t.covers.map((c) => {
    at(`rate-${c.cover}`);
    const def = coverById(v.covers, c.cover);
    const vpdUsed = def.environment === 'dampRoom' ? t.air.damp.vpd : t.air.start.vpd;
    const samples = calibration[c.cover]?.samples ?? 0;
    const calibrated = samples ? e.rate.calibrated(num('samples', String(samples))) : '';
    const multiplier = n('multiplier', c.multiplier, 2);
    const coverLine = (line: string): string =>
      `<span class="cover-line">${excludedMark(line + calibrated, c)}</span>`;
    if (t.physical && c.air !== undefined && c.factor !== undefined)
      return (
        coverLine(
          e.rate.cover(label(c.cover), multiplier, n('factor', c.factor, 2), n('air', c.air, 2)),
        ) +
        e.rate.row(
          one('calibrationOne'),
          n('multiplier', c.multiplier, 2),
          n('factor', c.factor, 2),
          n('air', c.air, 2),
          n('k', p.evaporationCoefficient, 2),
          n('area', piece.area, 4),
          n('vpd', vpdUsed, 2),
          n('slow', piece.slow, 2),
          gPerHour('rate', c.rate),
        )
      );
    return (
      coverLine(e.rate.modelCover(label(c.cover), multiplier)) +
      e.rate.modelRow(gPerHour('rate', c.rate))
    );
  });
  at('rate-night');
  const nightRates = t.covers
    .filter((c) => c.nightRate !== undefined)
    .map((c) => e.rate.nightRate(label(c.cover), gPerHour('nightRate', c.nightRate!)));
  out.push(
    step('rate', e.rate.title, [
      text(t.physical ? e.rate.text : e.rate.modelText),
      ...(t.physical ? [code(f.rate, f.rateSymbols)] : []),
      rows(rateRows),
      ...(nightRates.length
        ? [text(e.rate.night(nightFrom(), nightTo(), nightRates.join(', ')))]
        : []),
    ]),
  );

  // 7. time to the target per cover, the same hours as the comparison bars
  at('time');
  const timeText = e.time.text(
    link(e.terms.euler),
    dur('stepHours', p.stepHours),
    n('targetGrams', t.grams.target, 0),
  );
  const timeRows = t.covers.map((c) => {
    at(`time-${c.cover}`);
    return excludedMark(e.time.row(label(c.cover), dur('hours', c.hours)), c);
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
  const planLines: string[] = [];
  if (rec.status === 'invalidDeadline') {
    planLines.push(text(esc(m.errors.invalidDeadline)));
  } else {
    planLines.push(code(f.plan, f.planSymbols));
    planLines.push(text(e.plan.deadline(dur('deadline', H))));
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
          text(
            sentence(names(cs), esc(m.options.stage.soft), dur('dampMin', p.planner.dampMinHours)),
          ),
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
    const tol = (): string => n('tolerance', p.planner.targetTolerance * 100, 1);
    if (rec.status === 'tooFast')
      planLines.push(text(e.plan.tooFast(dur('fastest', rec.fastestHours), dur('deadline', H))));
    else if (rec.status === 'tooSlow')
      planLines.push(text(e.plan.tooSlow(dur('slowest', rec.slowestHours), dur('deadline', H))));
    else if (rec.option.kind === 'single')
      planLines.push(
        text(
          e.plan.single(
            label(rec.option.cover),
            dur('optionHours', rec.option.hours),
            dur('deadline', H),
            n('off', (Math.abs(rec.option.hours - H) / H) * 100, 1),
            tol(),
          ),
        ),
      );
    else
      planLines.push(
        text(
          e.plan.twoPhase(
            tol(),
            label(rec.option.first),
            dur('switchAfter', rec.option.switchAfterHours),
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
    const when = (id: NumId, hours: number): string =>
      num(id, fmt.dateTime(t.startMs + hours * MS_PER_HOUR));
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
                  when('ready', r.ready),
                  num('loss', formatNum(fmt, { kind: 'decimal', value: piece.lossPct, digits: 1 })),
                  num('targetGrams', formatNum(fmt, { kind: 'int', value: t.grams.target })),
                ),
              ),
              text(
                m.result.window(
                  when('windowStart', r.windowStart),
                  Number.isFinite(r.windowEnd)
                    ? when('windowEnd', r.windowEnd)
                    : m.result.windowOpenEnd,
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
 * numbers slide to their new value. An open tooltip closes: its number is gone.
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
  byId(TIP_ID).hidden = true;
}

const detailsOf = (root: HTMLElement): HTMLDetailsElement =>
  root.querySelector<HTMLDetailsElement>('.explainer details')!;

/** Whether the section is open, to keep it open across a language switch. */
export const isOpen = (root: HTMLElement): boolean => detailsOf(root).open;

/**
 * Opens the section at once, without its expand transition or reveal (after a language switch), so the
 * page has its full height straight away and a restored scroll position holds.
 */
export function open(root: HTMLElement): void {
  const details = detailsOf(root);
  details.classList.add('instant');
  details.open = true;
  // lays the open height out now, so removing the class starts no transition; it is back for the
  // reader's next toggle
  details.getBoundingClientRect();
  details.classList.remove('instant');
}

/** Gap between a number and its tooltip, and the tooltip's least distance from the card's edges, px. */
const TIP_GAP = 6;

/**
 * Shows `el`'s label in the bubble above it (below when there is no room), kept inside the card. Only a
 * visual copy: each number is described by its own hidden label, whatever was focused before.
 */
function showTip(section: HTMLElement, tip: HTMLElement, el: HTMLElement): void {
  tip.textContent = el.dataset.tip ?? '';
  tip.hidden = false;
  const s = section.getBoundingClientRect();
  const r = el.getBoundingClientRect();
  const w = tip.offsetWidth;
  const h = tip.offsetHeight;
  const left = Math.min(
    Math.max(TIP_GAP, r.left - s.left + r.width / 2 - w / 2),
    s.width - w - TIP_GAP,
  );
  const above = r.top - h - TIP_GAP >= 0;
  tip.style.left = `${left}px`;
  tip.style.top = `${above ? r.top - s.top - h - TIP_GAP : r.bottom - s.top + TIP_GAP}px`;
}

/** Escape anywhere closes an open bubble, also one shown by mouse hover (WCAG 1.4.13: dismissible). */
let escapeListening = false;
function closeOnEscape(): void {
  if (escapeListening) return;
  escapeListening = true;
  document.addEventListener('keydown', (e) => {
    const tip = document.getElementById(TIP_ID);
    if (e.key === 'Escape' && tip) tip.hidden = true;
  });
}

/**
 * Opening the section by the user (click or keyboard on the summary) reveals its steps one after another.
 * Numbers explain themselves on mouse hover, keyboard focus and tap; the bubble stays while the pointer
 * is on it, and Escape closes it.
 */
export function mount(root: HTMLElement, _ctx: AppContext): void {
  closeOnEscape();
  const details = detailsOf(root);
  const section = details.closest<HTMLElement>('.explainer')!;
  const tip = section.querySelector<HTMLElement>(`#${TIP_ID}`)!;
  const steps = section.querySelector<HTMLElement>('#explain-steps')!;
  details.querySelector('summary')!.addEventListener('click', () => {
    // the click comes before the toggle: closed now means it is opening
    if (!details.open) stagger(details.querySelectorAll<HTMLElement>('#explain-steps > li'));
  });
  const numberAt = (target: EventTarget | null): HTMLElement | null =>
    target instanceof Element ? target.closest<HTMLElement>('.num-tip') : null;
  const hide = (): void => {
    tip.hidden = true;
  };
  steps.addEventListener('focusin', (e) => {
    const el = numberAt(e.target);
    if (el) showTip(section, tip, el);
  });
  steps.addEventListener('focusout', hide);
  // touch: a tap focuses the number in most browsers; the click covers the rest
  steps.addEventListener('click', (e) => {
    const el = numberAt(e.target);
    if (el) showTip(section, tip, el);
  });
  steps.addEventListener('pointerover', (e) => {
    const el = numberAt(e.target);
    if (el && e.pointerType === 'mouse') showTip(section, tip, el);
  });
  steps.addEventListener('pointerout', (e) => {
    const el = numberAt(e.target);
    // still inside the same number, onto the bubble (hoverable), or it has focus: keep it
    if (!el || e.pointerType !== 'mouse' || numberAt(e.relatedTarget) === el) return;
    if (e.relatedTarget === tip || document.activeElement === el) return;
    hide();
  });
  tip.addEventListener('pointerleave', (e) => {
    if (e.pointerType === 'mouse' && !numberAt(e.relatedTarget)) hide();
  });
}
