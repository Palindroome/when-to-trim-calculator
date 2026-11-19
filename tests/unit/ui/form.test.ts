import { afterEach, describe, expect, it, vi } from 'vitest';
import { DEFAULT_PARAMS } from '../../../src/domain/params';
import type { Conditions } from '../../../src/domain/types';
import { createFormatter } from '../../../src/i18n';
import { en } from '../../../src/i18n/en';
import { pl } from '../../../src/i18n/pl';
import {
  combineLocalDateTime,
  dayLabel,
  extremeTemp,
  LARGE_STEP,
  NUMBER_FIELDS,
  normalizeTime,
  parseNumber,
  readAllowedCovers,
  stepNumber,
  toDayKey,
  toTime,
  validateNumber,
} from '../../../src/ui/form';

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

describe('validateNumber', () => {
  it.each([
    ['mass', '0', 'range'],
    ['mass', '-0,1', 'range'],
    ['mass', '-500', 'range'],
    ['mass', '0,1', 'ok'],
    ['mass', '5', 'ok'],
    ['wall', '0', 'range'],
    ['wall', '-0,1', 'range'],
    ['wall', '0,1', 'ok'],
    ['base', '0', 'range'],
    ['base', '0.1', 'ok'],
    ['mnow', '-100', 'range'],
    ['mnow', '480', 'ok'],
    ['rh', '0', 'ok'],
    ['rh', '-0', 'ok'],
    ['rh', '100', 'ok'],
    ['rh', '100,1', 'range'],
    ['rh', '-1', 'range'],
    ['nrh', '150', 'range'],
    ['drh', '100', 'ok'],
    ['temp', '-200', 'ok'],
    ['temp', '200', 'ok'],
    ['temp', '200,1', 'range'],
    ['temp', '-200,1', 'range'],
    ['temp', '-51', 'ok'],
    ['temp', '51', 'ok'],
    ['ntemp', '-300', 'range'],
    ['dtemp', '1000', 'range'],
  ] as const)('%s %j -> %s', (id, raw, check) => {
    expect(validateNumber(id, raw)).toBe(check);
  });

  it('reads a decimal comma or dot, with surrounding spaces', () => {
    for (const raw of ['6,5', '6.5', ' 6,5 ', ',5', '6,', '+6'])
      expect(validateNumber('wall', raw)).toBe('ok');
    expect(validateNumber('rh', '100,0')).toBe('ok');
    expect(validateNumber('rh', '99,99')).toBe('ok');
  });

  it('an empty field is not an error', () => {
    for (const id of ['mass', 'base', 'mnow', 'temp', 'rh'] as const) {
      expect(validateNumber(id, '')).toBe('empty');
      expect(validateNumber(id, '  ')).toBe('empty');
    }
  });

  it.each(['abc', '-', ',', '12abc', '1,2,3', 'Infinity', '1e3', '6 g'])(
    '%j is not a number',
    (raw) => {
      expect(validateNumber('mass', raw)).toBe('nan');
    },
  );
});

describe('stepNumber', () => {
  const F = NUMBER_FIELDS;
  it('steps by the field step and writes the locale separator without a trailing zero', () => {
    expect(stepNumber('6,5', F.wall, 1, 6, ',')).toBe('7');
    expect(stepNumber('6', F.wall, -1, 6, ',')).toBe('5,5');
    expect(stepNumber('6', F.wall, -1, 6, '.')).toBe('5.5');
    expect(stepNumber('500', F.mass, 1, 500, ',')).toBe('510');
  });
  it('steps an empty or unreadable field from its fallback', () => {
    expect(stepNumber('', F.mass, 1, 500, ',')).toBe('510');
    expect(stepNumber('abc', F.base, 1, 6, ',')).toBe('6,5');
  });
  it('keeps within the bounds', () => {
    expect(stepNumber('100', F.rh, 1, 50, ',')).toBe('100');
    expect(stepNumber('0', F.rh, -1, 50, ',')).toBe('0');
    expect(stepNumber('100', F.drh, LARGE_STEP, 88, ',')).toBe('100');
    expect(stepNumber('0,5', F.wall, -1, 6, ',')).toBe('0,5');
    expect(stepNumber('0,5', F.base, -1, 6, ',')).toBe('0,5');
    expect(stepNumber('10', F.mass, -1, 500, ',')).toBe('10');
    expect(stepNumber('50', F.mass, -LARGE_STEP, 500, ',')).toBe('10');
    expect(stepNumber('1', F.mnow, -1, 500, ',')).toBe('1');
  });
  it('temperatures go below zero and keep to their valid range', () => {
    expect(stepNumber('0', F.temp, -1, 20, ',')).toBe('-1');
    expect(stepNumber('-3,5', F.temp, -LARGE_STEP, 20, ',')).toBe('-13,5');
    expect(stepNumber('-195', F.ntemp, -LARGE_STEP, 15, ',')).toBe('-200');
    expect(stepNumber('200', F.dtemp, 1, 15, ',')).toBe('200');
  });
  it('never steps against its direction: a value outside the range only moves towards it', () => {
    // valid, but below the lowest stepped mass: Down leaves it instead of jumping up to 10
    expect(stepNumber('5', F.mass, -1, 500, ',')).toBe('5');
    expect(stepNumber('0,2', F.wall, -1, 6, ',')).toBe('0,2');
    // out of range: a step away leaves it, a step towards the range lands within it
    expect(stepNumber('-5', F.mass, -1, 500, ',')).toBe('-5');
    expect(stepNumber('-5', F.mass, 1, 500, ',')).toBe('10');
    expect(stepNumber('150', F.rh, 1, 50, ',')).toBe('150');
    expect(stepNumber('150', F.rh, -1, 50, ',')).toBe('100');
    expect(stepNumber('-300', F.temp, 1, 20, ',')).toBe('-200');
  });
  it('an empty field stepping from an out-of-range fallback lands within the range', () => {
    // e.g. an empty base below a wall of -3 mm, an empty mass now below a thrown mass of 0 g
    expect(stepNumber('', F.base, -1, -3, ',')).toBe('0,5');
    expect(stepNumber('', F.mnow, -1, 0, ',')).toBe('1');
    expect(stepNumber('abc', F.rh, 1, 150, ',')).toBe('100');
  });
  it('never turns a valid value into one the validator flags', () => {
    for (const id of Object.keys(F) as (keyof typeof F)[]) {
      const f = F[id];
      const lowest = f.minExclusive ? f.min + f.step : f.min;
      const highest = Number.isFinite(f.max) ? f.max : 1000;
      for (const raw of [lowest, f.step / 2, highest, (lowest + highest) / 2].map(String))
        for (const steps of [1, -1, LARGE_STEP, -LARGE_STEP]) {
          if (validateNumber(id, raw) !== 'ok') continue;
          expect(validateNumber(id, stepNumber(raw, f, steps, 0, '.'))).toBe('ok');
        }
    }
  });
  it('takes a large step of ten steps', () => {
    expect(stepNumber('500', F.mass, LARGE_STEP, 500, ',')).toBe('600');
    expect(stepNumber('6', F.wall, -LARGE_STEP, 6, ',')).toBe('1');
    expect(stepNumber('50', F.rh, LARGE_STEP, 50, ',')).toBe('60');
  });
  it('leaves no float noise', () => {
    const tenth = { ...F.rh, step: 0.1 };
    expect(stepNumber('0,2', tenth, 1, 0, ',')).toBe('0,3');
    expect(stepNumber('0,7', tenth, LARGE_STEP, 0, '.')).toBe('1.7');
    expect(stepNumber('6,37', F.wall, 1, 6, ',')).toBe('6,87');
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
  it.each([
    '',
    ' ',
    '24:00',
    '24',
    '9:60',
    '960',
    'abc',
    '9:',
    ':17',
    '9:5',
    '12345',
    '-1',
    '9 17',
    '9pm',
  ])('%j is invalid', (raw) => {
    expect(normalizeTime(raw)).toBeNull();
  });
});

describe('combineLocalDateTime', () => {
  it('gives local epoch ms for a day key and a typed time', () => {
    expect(combineLocalDateTime('2026-03-04', '917')).toBe(new Date(2026, 2, 4, 9, 17).getTime());
    expect(combineLocalDateTime('2026-03-04', '09:00')).toBe(new Date(2026, 2, 4, 9, 0).getTime());
  });
  it('is NaN for an invalid time or an empty day', () => {
    for (const t of ['', '24:00', '9:60', 'abc'])
      expect(combineLocalDateTime('2026-03-04', t)).toBeNaN();
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
    expect(dayLabel(pl, fmt, '2026-03-28', new Date(2026, 2, 29, 0, 30).getTime())).toBe(
      'wczoraj · sob 28.03',
    );
    expect(dayLabel(pl, fmt, '', now)).toBe('');
  });
});

describe('extremeTemp', () => {
  const base: Conditions = {
    temp: 20,
    rh: 50,
    airflow: 'light',
    night: false,
    nightTemp: 15,
    nightRh: 60,
    dampTemp: 15,
    dampRh: 88,
  };
  const none = { hot: false, cold: false };

  it('is none at exactly ±50 and just beyond is hot or cold', () => {
    expect(extremeTemp({ ...base, temp: 50 })).toEqual(none);
    expect(extremeTemp({ ...base, temp: -50 })).toEqual(none);
    expect(extremeTemp({ ...base, temp: 50.1 })).toEqual({ hot: true, cold: false });
    expect(extremeTemp({ ...base, temp: -50.1 })).toEqual({ hot: false, cold: true });
  });

  it('counts the night temperature only while night is on', () => {
    expect(extremeTemp({ ...base, nightTemp: 60 })).toEqual(none);
    expect(extremeTemp({ ...base, night: true, nightTemp: 60 })).toEqual({
      hot: true,
      cold: false,
    });
  });

  it('always counts the damp-room temperature', () => {
    expect(extremeTemp({ ...base, dampTemp: -60 })).toEqual({ hot: false, cold: true });
  });

  it('can be hot and cold together', () => {
    expect(extremeTemp({ ...base, temp: 60, dampTemp: -60 })).toEqual({ hot: true, cold: true });
  });
});

describe('readAllowedCovers', () => {
  afterEach(() => vi.unstubAllGlobals());

  it('returns the ticked covers in cover-list order', () => {
    // the unit tests run without a DOM: stub the one query the reader makes
    const boxes = [
      { cover: 'box', checked: true },
      { cover: 'open', checked: false },
      { cover: 'full', checked: true },
      { cover: 'partial', checked: true },
      { cover: 'damp', checked: false },
    ].map(({ cover, checked }) => ({ checked, dataset: { cover } }));
    vi.stubGlobal('document', {
      querySelectorAll: (sel: string) => (sel === 'input[data-cover]' ? boxes : []),
    });
    expect(readAllowedCovers(DEFAULT_PARAMS.covers)).toEqual(['partial', 'full', 'box']);
  });
});
