// "How it calculates": the calculation of the current recommendation as numbered steps, folded by default.
import type { CoverCalibration } from '../../../domain/calibration';
import { type CoverId, coverById } from '../../../domain/covers';
import type { CalculationTrace, CoverTrace } from '../../../domain/explain';
import { MS_PER_HOUR } from '../../../domain/params';
import type { Climate } from '../../../domain/physics';
import type { Messages } from '../../../i18n';
import type { AppContext } from '../../context';
import { byId, esc } from '../../dom';
import { icon } from '../../icons';
import { stagger } from '../../motion';
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

const step = (key: string, title: string, lines: string[]): string =>
  `<li data-explain="${key}"><h3>${esc(title)}</h3>${lines.join('')}</li>`;
const text = (s: string): string => `<p>${esc(s)}</p>`;
const formula = (s: string): string => `<p class="formula">${esc(s)}</p>`;
const rows = (items: string[]): string =>
  `<ul class="rows">${items.map((s) => `<li class="formula">${esc(s)}</li>`).join('')}</ul>`;

/** The steps for `t`; `calibration` gives the number of rated pieces behind each multiplier. */
export function renderSteps(
  v: View,
  t: CalculationTrace,
  calibration: Record<CoverId, CoverCalibration>,
): string {
  const { m, fmt, params: p } = v;
  const e = m.explainer;
  /** at most `digits` decimals, trailing zeros dropped */
  const n = (x: number, digits: number): string =>
    digits ? fmt.decimal(x, digits).replace(/0+$/, '').replace(/\D$/, '') : fmt.decimal(x, 0);
  /** g/h: slow covers in humid air get a third decimal instead of rounding to 0 */
  const gPerHour = (x: number): string => n(x, x < 0.1 ? 3 : 2);
  const signed = (x: number): string => (x < 0 ? `− ${n(-x, 1)}` : `+ ${n(x, 1)}`);
  const label = (id: CoverId): string => coverLabel(m, coverById(v.covers, id));
  const { input, piece } = t;
  const night = { from: String(p.night.fromHour), to: String(p.night.toHour) };
  const out: string[] = [];

  // 1. inputs, after the clamps
  const clamps: string[] = [];
  if (input.massG < p.piece.minMassG) clamps.push(e.inputs.massClamped(n(p.piece.minMassG, 1)));
  if (input.wallMm < p.piece.minWallMm) clamps.push(e.inputs.wallClamped(n(p.piece.minWallMm, 1)));
  if (input.baseMm === undefined) clamps.push(e.inputs.baseFromWall);
  else if (input.baseMm < p.piece.minBaseMm)
    clamps.push(e.inputs.baseClamped(n(p.piece.minBaseMm, 1)));
  out.push(
    step('inputs', e.inputs.title, [
      text(e.inputs.values(n(piece.mass, 1), n(piece.wall, 1), n(piece.base, 1))),
      ...clamps.map(text),
    ]),
  );

  // 2. exposed surface
  out.push(
    step('surface', e.surface.title, [
      text(e.surface.text),
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
          m.options.shape[input.shape],
          n(piece.area, 4),
        ),
      ),
    ]),
  );

  // 3. slowness
  out.push(
    step('slowness', e.slowness.title, [
      text(e.slowness.text),
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
  out.push(
    step('target', e.target.title, [
      text(e.target.text(m.options.stage[input.stage])),
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
  const vpd = (where: string, c: Climate): string =>
    e.air.vpd(where, n(c.temp, 1), n(c.rh, 1), n(c.psat, 1), n(c.rhUsed, 1), n(c.vpd, 2)) +
    (c.vpd === p.minVpd ? e.air.floor(n(p.minVpd, 2)) : '');
  const climates = [vpd(e.air.start, t.air.start)];
  if (t.air.night) climates.push(vpd(e.air.night(night.from, night.to), t.air.night));
  if (v.covers.some((c) => c.environment === 'dampRoom'))
    climates.push(vpd(e.air.damp, t.air.damp));
  out.push(
    step('air', e.air.title, [
      text(e.air.text),
      rows(climates),
      text(e.air.airflow(m.options.airflow[t.air.airflow], n(t.air.airflowFactor, 2))),
    ]),
  );

  // 6. rate per cover, at the throwing time
  const k = n(p.evaporationCoefficient, 2);
  const rateRows = t.covers.map((c) => {
    const rate = gPerHour(c.rate);
    const def = coverById(v.covers, c.cover);
    const vpdUsed = def.environment === 'dampRoom' ? t.air.damp.vpd : t.air.start.vpd;
    const row =
      t.physical && c.air !== undefined && c.factor !== undefined
        ? e.rate.row(
            label(c.cover),
            k,
            n(piece.area, 4),
            n(vpdUsed, 2),
            n(c.air, 2),
            n(c.factor, 2),
            n(piece.slow, 2),
            n(c.multiplier, 2),
            rate,
          )
        : e.rate.modelRow(label(c.cover), rate);
    const samples = calibration[c.cover]?.samples ?? 0;
    return samples ? `${row} · ${e.rate.calibrated(samples)}` : row;
  });
  const nightRates = t.covers
    .filter((c) => c.nightRate !== undefined)
    .map((c) => e.rate.nightRate(label(c.cover), gPerHour(c.nightRate!)));
  out.push(
    step('rate', e.rate.title, [
      text(t.physical ? e.rate.text(k) : e.rate.modelText),
      rows(rateRows),
      ...(nightRates.length
        ? [text(e.rate.night(night.from, night.to, nightRates.join(', ')))]
        : []),
    ]),
  );

  // 7. time to the target per cover, the same hours as the comparison bars
  out.push(
    step('time', e.time.title, [
      text(e.time.text(fmt.duration(p.stepHours), n(t.grams.target, 0))),
      ...(t.air.night ? [text(e.time.night)] : []),
      rows(
        t.covers.map((c) => {
          const row = e.time.row(label(c.cover), fmt.duration(c.hours));
          return c.excluded ? `${row} · ${m.result.excludedBar}` : row;
        }),
      ),
    ]),
  );

  // 8. choosing the plan
  const rec = t.plan.recommendation;
  const H = t.plan.deadlineHours;
  const tol = n(p.planner.targetTolerance * 100, 1);
  const planLines: string[] = [];
  if (rec.status === 'invalidDeadline') {
    planLines.push(text(m.errors.invalidDeadline));
  } else {
    planLines.push(text(e.plan.deadline(fmt.duration(H))));
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
          text(sentence(names(cs), m.options.stage.soft, fmt.duration(p.planner.dampMinHours))),
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
      planLines.push(text(e.plan.tooFast(fmt.duration(rec.fastestHours), fmt.duration(H))));
    else if (rec.status === 'tooSlow')
      planLines.push(text(e.plan.tooSlow(fmt.duration(rec.slowestHours), fmt.duration(H))));
    else if (rec.option.kind === 'single')
      planLines.push(
        text(
          e.plan.single(
            label(rec.option.cover),
            fmt.duration(rec.option.hours),
            fmt.duration(H),
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
            fmt.duration(rec.option.switchAfterHours),
            label(rec.option.then),
          ),
        ),
      );
  }
  out.push(step('plan', e.plan.title, planLines));

  // 9. result, worded exactly as in the recommendation
  if (rec.status !== 'invalidDeadline') {
    const at = (hours: number): string => fmt.dateTime(t.startMs + hours * MS_PER_HOUR);
    const r = t.result;
    out.push(
      step(
        'result',
        e.result.title,
        r
          ? [
              text(
                m.result.ready(
                  at(r.ready),
                  formatNum(fmt, { kind: 'decimal', value: piece.lossPct, digits: 1 }),
                  formatNum(fmt, { kind: 'int', value: t.grams.target }),
                ),
              ),
              text(
                m.result.window(
                  at(r.windowStart),
                  Number.isFinite(r.windowEnd) ? at(r.windowEnd) : m.result.windowOpenEnd,
                ),
              ),
            ]
          : [text(e.result.none)],
      ),
    );
  }
  return out.join('');
}

/** Re-renders only the steps, so an open <details> and the scroll position stay as they are. */
export function update(
  v: View,
  t: CalculationTrace,
  calibration: Record<CoverId, CoverCalibration>,
): void {
  byId('explain-steps').innerHTML = renderSteps(v, t, calibration);
}

/** Opening the section reveals its steps one after another. */
export function mount(root: HTMLElement, _ctx: AppContext): void {
  const details = root.querySelector<HTMLDetailsElement>('.explainer details')!;
  details.addEventListener('toggle', () => {
    if (details.open) stagger(details.querySelectorAll<HTMLElement>('#explain-steps > li'));
  });
}
