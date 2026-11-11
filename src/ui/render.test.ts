import { describe, expect, it } from 'vitest';
import { DEFAULT_PARAMS } from '../domain/params';
import { createFormatter, type Messages } from '../i18n';
import { en } from '../i18n/en';
import { pl } from '../i18n/pl';
import type { StoredPiece } from '../storage/pieces';
import { renderPieceList, renderSummaries, type SummaryInput, type View } from './render';

const view = (m: Messages): View => ({ m, params: DEFAULT_PARAMS, fmt: createFormatter(m, 30) });
const start = new Date(2026, 2, 4, 9, 0).getTime();

const piece = (over: Partial<StoredPiece>): StoredPiece => ({
  id: 'a',
  name: 'mugs',
  start,
  mass: 500,
  lossPct: 6,
  plan: [{ w: 'open', h: null }],
  label: 'stored label',
  dom: 'open',
  predH: 49,
  calUsed: 1,
  ws: 1,
  we: 2,
  fb: null,
  ...over,
});

/** The plan sentence: the text of `.meta` before the line break. */
const planLine = (v: View, p: StoredPiece): string => {
  const html = renderPieceList(v, [p], start);
  return /<div class="meta">(.*?)<br>/.exec(html)![1]!;
};

describe('renderPieceList plan sentence', () => {
  it('re-renders a single-cover plan in the current language', () => {
    const p = piece({ plan: [{ w: 'box', h: null }], label: 'Włóż do zamkniętego pudełka od razu.' });
    expect(planLine(view(en), p)).toBe('Put in a closed box straight away.');
    expect(planLine(view(pl), p)).toBe('Włóż do zamkniętego pudełka od razu.');
  });

  it('re-renders a two-phase plan with its switch time', () => {
    const p = piece({
      plan: [
        { w: 'open', h: 3.5 },
        { w: 'full', h: null },
      ],
      label: 'Zostaw odkrytą na 4 h (do śr 4.03 12:30), potem zawiń całą w worek.',
    });
    expect(planLine(view(en), p)).toBe('Leave uncovered for 4 h (until Wed 4 Mar 12:30), then wrap fully in a bag.');
    // Polish output equals the label the current app stores for this piece
    expect(planLine(view(pl), p)).toBe(p.label);
  });

  it.each<[string, unknown]>([
    [
      'three steps',
      [
        { w: 'open', h: 1 },
        { w: 'partial', h: 2 },
        { w: 'full', h: null },
      ],
    ],
    ['empty', []],
    ['not an array', null],
    ['unknown cover', [{ w: 'shelf', h: null }]],
    [
      'first step without hours',
      [
        { w: 'open', h: null },
        { w: 'full', h: null },
      ],
    ],
    ['open-ended first step', [{ w: 'open', h: 2 }]],
    [
      'last step with hours',
      [
        { w: 'open', h: 2 },
        { w: 'full', h: 5 },
      ],
    ],
  ])('falls back to the stored label for an unexpected plan (%s)', (_, plan) => {
    const p = piece({ plan: plan as StoredPiece['plan'], label: 'Etykieta <b>' });
    expect(planLine(view(en), p)).toBe('Etykieta &lt;b&gt;');
  });
});

describe('renderSummaries', () => {
  const input: SummaryInput = {
    name: '',
    piece: { massG: 500, shape: 'cyl', wallMm: 6, baseMm: 9, clay: 'stone', bat: 'wood', wetness: 'normal', stage: 'trim' },
    conditions: { temp: 20, rh: 50, airflow: 'light', night: false, nightTemp: 15, nightRh: 60, dampTemp: 15, dampRh: 88 },
    thrownMs: start,
    whenMs: new Date(2026, 2, 6, 10, 0).getTime(),
  };

  it('summarises the three form sections in Polish', () => {
    expect(renderSummaries(view(pl), input)).toEqual([
      'Kubek / cylinder · 500 g · ścianka 6 mm, dno 9 mm · Kamionka gładka',
      '20 °C, 50% · Lekki ruch (ludzie, wentylacja)',
      'Wytoczona śr 4.03 09:00 · trymowanie pt 6.03 10:00',
    ]);
  });

  it('adds the name and night values, falls back to the wall for an empty base, uses a decimal comma', () => {
    const [piece, conditions, schedule] = renderSummaries(view(pl), {
      ...input,
      name: 'kubki',
      piece: { ...input.piece, wallMm: 6.5, baseMm: undefined },
      conditions: { ...input.conditions, night: true },
      whenMs: NaN,
    });
    expect(piece).toBe('kubki · Kubek / cylinder · 500 g · ścianka 6,5 mm, dno 6,5 mm · Kamionka gładka');
    expect(conditions).toBe('20 °C, 50% · Lekki ruch (ludzie, wentylacja) · noc 15 °C, 60%');
    expect(schedule).toBe('Wytoczona śr 4.03 09:00 · trymowanie –');
  });

  it('follows the language', () => {
    expect(renderSummaries(view(en), input)[2]).toBe('Thrown Wed 4 Mar 09:00 · trim Fri 6 Mar 10:00');
  });
});
