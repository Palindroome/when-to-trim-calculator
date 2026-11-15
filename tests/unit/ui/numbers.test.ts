import { describe, expect, it } from 'vitest';
import { createFormatter } from '../../../src/i18n';
import { en } from '../../../src/i18n/en';
import { pl } from '../../../src/i18n/pl';
import { formatNum, type NumValue, num, shouldSnap } from '../../../src/ui/numbers';

const fmt = createFormatter(pl, 30);
const at = new Date(2026, 2, 4, 9, 0).getTime();

describe('formatNum', () => {
  it('writes exactly what the formatter writes, per kind', () => {
    for (const f of [fmt, createFormatter(en, 30)]) {
      for (const h of [0.4, 5, 27.4, 47.6, 48, Infinity])
        expect(formatNum(f, { kind: 'duration', value: h })).toBe(f.duration(h));
      expect(formatNum(f, { kind: 'dateTime', value: at })).toBe(f.dateTime(at));
      expect(formatNum(f, { kind: 'decimal', value: 6.25, digits: 1 })).toBe(f.decimal(6.25, 1));
    }
    expect(formatNum(fmt, { kind: 'int', value: 31.6 })).toBe('32');
    expect(formatNum(fmt, { kind: 'duration', value: 300, suffix: '+' })).toBe(
      `${fmt.duration(300)}+`,
    );
  });

  it('wraps a number in a span whose text is the formatted value', () => {
    expect(num(fmt, 'loss', { kind: 'decimal', value: 6.25, digits: 1 })).toBe(
      '<span class="num" data-num-key="loss" data-num-kind="decimal" data-num-value="6.25" data-num-digits="1">6,3</span>',
    );
    expect(num(fmt, 'bar-open', { kind: 'duration', value: 300, suffix: '+' })).toBe(
      `<span class="num" data-num-key="bar-open" data-num-kind="duration" data-num-value="300" data-num-suffix="+">${fmt.duration(300)}+</span>`,
    );
  });
});

describe('shouldSnap', () => {
  const d = (value: number, suffix?: string): NumValue =>
    suffix === undefined ? { kind: 'duration', value } : { kind: 'duration', value, suffix };
  const cases: [string, NumValue, NumValue, boolean][] = [
    ['a visible change counts', d(27), d(40), false],
    ['the same text snaps', d(27.1), d(27.2), true],
    ['another kind snaps', d(27), { kind: 'int', value: 40 }, true],
    [
      'other decimals snap',
      { kind: 'decimal', value: 5, digits: 1 },
      { kind: 'decimal', value: 6, digits: 2 },
      true,
    ],
    ['from beyond the horizon snaps', d(Infinity), d(40), true],
    ['to beyond the horizon snaps', d(40), d(Infinity), true],
    ['the + suffix appearing snaps', d(200), d(300, '+'), true],
    ['the + suffix going snaps', d(300, '+'), d(200), true],
    ['an empty suffix is no suffix', d(20, ''), d(40), false],
  ];
  it.each(cases)('%s', (_, prev, next, snap) => {
    expect(shouldSnap(fmt, prev, next)).toBe(snap);
  });
});
