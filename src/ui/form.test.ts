import { describe, expect, it } from 'vitest';
import { createFormatter } from '../i18n';
import { en } from '../i18n/en';
import { pl } from '../i18n/pl';
import { combineLocalDateTime, dayLabel, normalizeTime, parseNumber, toDayKey, toTime } from './form';

describe('parseNumber', () => {
  it.each([
    ['6', 6],
    ['6.5', 6.5],
    ['6,5', 6.5],
    [' 6,5 ', 6.5],
    ['-3,5', -3.5],
    ['-2.5', -2.5],
    [' 7 ', 7],
    ['12abc', 12],
  ])('%j -> %s', (raw, v) => {
    expect(parseNumber(raw, 0)).toBe(v);
  });
  it.each(['', 'abc', 'Infinity', '-Infinity'])('%j falls back', (raw) => {
    expect(parseNumber(raw, 42)).toBe(42);
  });
});

describe('toDayKey / toTime', () => {
  it('format local date and 24 h time', () => {
    expect(toDayKey(new Date(2026, 0, 2, 3, 4))).toBe('2026-01-02');
    expect(toTime(new Date(2026, 0, 2, 3, 4))).toBe('03:04');
    expect(toTime(new Date(2026, 0, 2, 23, 59))).toBe('23:59');
  });
});

describe('normalizeTime', () => {
  it.each([
    ['9', '09:00'],
    ['09', '09:00'],
    ['917', '09:17'],
    ['0917', '09:17'],
    ['9:17', '09:17'],
    ['9.17', '09:17'],
    ['09:17', '09:17'],
    [' 9:17 ', '09:17'],
    ['0', '00:00'],
    ['23:59', '23:59'],
    ['1230', '12:30'],
  ])('%j -> %s', (raw, time) => {
    expect(normalizeTime(raw)).toBe(time);
  });
  it.each(['', ' ', '24:00', '24', '9:60', '960', 'abc', '9:', ':17', '9:5', '12345', '-1', '9 17', '9pm'])('%j is invalid', (raw) => {
    expect(normalizeTime(raw)).toBeNull();
  });
});

describe('combineLocalDateTime', () => {
  it('gives local epoch ms for a day key and a typed time', () => {
    expect(combineLocalDateTime('2026-03-04', '917')).toBe(new Date(2026, 2, 4, 9, 17).getTime());
    expect(combineLocalDateTime('2026-03-04', '09:00')).toBe(new Date(2026, 2, 4, 9, 0).getTime());
  });
  it('is NaN for an invalid time or an empty day', () => {
    for (const t of ['', '24:00', '9:60', 'abc']) expect(combineLocalDateTime('2026-03-04', t)).toBeNaN();
    expect(combineLocalDateTime('', '09:00')).toBeNaN();
  });
  it('treats DST change days like the former datetime-local value', () => {
    // Europe/Warsaw: 02:30 does not exist on 29 March and occurs twice on 25 October
    for (const [day, time] of [
      ['2026-03-29', '02:30'],
      ['2026-10-25', '02:30'],
    ] as const) {
      expect(combineLocalDateTime(day, time)).toBe(new Date(`${day}T${time}`).getTime());
    }
  });
});

describe('dayLabel', () => {
  const now = new Date(2026, 2, 4, 9, 0).getTime(); // Wed 4 March 2026

  const days = ['2026-03-02', '2026-03-03', '2026-03-04', '2026-03-05', '2026-03-06'];

  it('labels days in Polish with relative words for yesterday, today and tomorrow', () => {
    expect(days.map((d) => dayLabel(pl, createFormatter(pl, 30), d, now))).toEqual([
      'pn 2.03',
      'wczoraj · wt 3.03',
      'dziś · śr 4.03',
      'jutro · czw 5.03',
      'pt 6.03',
    ]);
  });

  it('labels days in English', () => {
    expect(days.slice(1, 4).map((d) => dayLabel(en, createFormatter(en, 30), d, now))).toEqual([
      'yesterday · Tue 3 Mar',
      'today · Wed 4 Mar',
      'tomorrow · Thu 5 Mar',
    ]);
  });

  it('works across month ends and DST changes, and is empty for no day', () => {
    const fmt = createFormatter(pl, 30);
    const lastOfMarch = new Date(2026, 2, 31, 23, 30).getTime();
    expect(dayLabel(pl, fmt, '2026-04-01', lastOfMarch)).toBe('jutro · śr 1.04');
    // Europe/Warsaw moves to summer time on 29 March 2026
    expect(dayLabel(pl, fmt, '2026-03-28', new Date(2026, 2, 29, 0, 30).getTime())).toBe('wczoraj · sob 28.03');
    expect(dayLabel(pl, fmt, '', now)).toBe('');
  });
});
