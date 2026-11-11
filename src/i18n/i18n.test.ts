import { describe, expect, it } from 'vitest';
import { createFormatter } from './format';
import { en } from './en';
import { DEFAULT_LOCALE, getMessages, LOCALES, resolveLocale } from './index';
import { pl } from './pl';

const fmt = createFormatter(pl, 30);

describe('duration', () => {
  it.each([
    [0, '1 min'],
    [-3, '1 min'],
    [0.001, '1 min'],
    [0.2, '12 min'],
    [0.999, '60 min'],
    [1, '1 h'],
    [5.6, '6 h'],
    [23.6, '24 h'],
    [24, '1 d'],
    [25, '1 d 1 h'],
    [47.6, '2 d'],
    [49.2, '2 d 1 h'],
    [24 * 7 + 15.4, '7 d 15 h'],
    [Infinity, '> 30 dni'],
    [NaN, '> 30 dni'],
  ])('%s h -> %s', (h, s) => {
    expect(fmt.duration(h)).toBe(s);
  });
});

describe('dateTime', () => {
  it('formats weekday, day.month and time', () => {
    expect(fmt.dateTime(new Date(2026, 2, 4, 9, 5).getTime())).toBe('śr 4.03 09:05');
    expect(fmt.dateTime(new Date(2026, 10, 8, 23, 59).getTime())).toBe('nd 8.11 23:59');
  });
  it('keeps the prototype output for an invalid date', () => {
    expect(fmt.dateTime(NaN)).toBe('undefined NaN.NaN NaN:NaN');
  });
});

describe('date', () => {
  it('formats weekday and day.month without the time', () => {
    expect(fmt.date(new Date(2026, 2, 4, 9, 5).getTime())).toBe('śr 4.03');
    expect(createFormatter(en, 30).date(new Date(2026, 10, 8, 23, 59).getTime())).toBe('Sun 8 Nov');
  });
});

describe('decimal', () => {
  it('uses a decimal comma', () => {
    expect(fmt.decimal(6, 1)).toBe('6,0');
    expect(fmt.decimal(1.005, 2)).toBe('1,00');
    expect(fmt.decimal(-4, 1)).toBe('-4,0');
  });
});

describe('catalog', () => {
  it('plan sentences', () => {
    const p = pl.covers.phrase;
    expect(pl.plan.single(p.open)).toBe('Zostaw odkrytą od razu.');
    expect(pl.plan.twoPhase(p.partial, '3 h', 'śr 4.03 12:00', p.box)).toBe(
      'Przykryj luźno workiem (dno lub brzeg odsłonięte) na 3 h (do śr 4.03 12:00), potem włóż do zamkniętego pudełka.',
    );
  });
  it('quick date labels', () => {
    expect([1, 2, 3, 5, 7].map(pl.quickDate)).toEqual(['jutro', 'za 2 dni', 'za 3 dni', 'za 5 dni', 'za tydzień']);
  });
  it('locale registry falls back to Polish', () => {
    expect(LOCALES.pl).toBe(pl);
    expect(getMessages('xx')).toBe(pl);
  });
});

describe('English', () => {
  const efmt = createFormatter(en, 30);

  it('is registered', () => {
    expect(LOCALES.en).toBe(en);
    expect(getMessages('en')).toBe(en);
    expect(en.lang).toBe('en');
    expect(en.title).toBe('When to trim? – prototype');
  });

  it.each([
    [0, '1 min'],
    [0.2, '12 min'],
    [1, '1 h'],
    [23.6, '24 h'],
    [24, '1 d'],
    [25, '1 d 1 h'],
    [47.6, '2 d'],
    [24 * 7 + 15.4, '7 d 15 h'],
    [Infinity, '> 30 days'],
  ])('duration %s h -> %s', (h, s) => {
    expect(efmt.duration(h)).toBe(s);
  });

  it('dateTime: weekday, day, month name, 24-hour time', () => {
    expect(efmt.dateTime(new Date(2026, 2, 4, 10, 0).getTime())).toBe('Wed 4 Mar 10:00');
    expect(efmt.dateTime(new Date(2026, 10, 8, 23, 59).getTime())).toBe('Sun 8 Nov 23:59');
    expect(efmt.dateTime(new Date(2026, 0, 1, 7, 5).getTime())).toBe('Thu 1 Jan 07:05');
  });

  it('decimal point', () => {
    expect(efmt.decimal(6, 1)).toBe('6.0');
    expect(efmt.decimal(1.234, 2)).toBe('1.23');
  });

  it('catalog sentences', () => {
    const p = en.covers.phrase;
    expect(en.plan.single(p.open)).toBe('Leave uncovered straight away.');
    expect(en.plan.twoPhase(p.open, '4 h', 'Wed 4 Mar 12:30', p.full)).toBe(
      'Leave uncovered for 4 h (until Wed 4 Mar 12:30), then wrap fully in a bag.',
    );
    expect([1, 2, 3, 5, 7].map(en.quickDate)).toEqual(['tomorrow', 'in 2 days', 'in 3 days', 'in 5 days', 'in a week']);
  });

  it('has the same 12 month and 7 weekday names as Polish', () => {
    expect(en.format.monthsShort).toHaveLength(12);
    expect(pl.format.monthsShort).toHaveLength(12);
    expect(en.format.weekdaysShort).toHaveLength(7);
  });

  it('contains no untranslated Polish text', () => {
    const strings: string[] = [];
    const walk = (x: unknown): void => {
      if (typeof x === 'string') strings.push(x);
      else if (typeof x === 'function') {
        // call with plausible arguments so the template text is checked too
        const out: unknown = x(...Array.from({ length: x.length }, (_, i) => (i === 0 ? 'open' : 'full')));
        walk(out);
      } else if (x && typeof x === 'object') Object.values(x).forEach(walk);
    };
    walk(en);
    expect(strings.length).toBeGreaterThan(100);
    expect(strings.filter((s) => /[ąćęłńóśźż]/i.test(s))).toEqual([]);
  });
});

describe('resolveLocale', () => {
  const available = ['pl', 'en'];
  const base = { stored: null, browser: [] as string[], hasExistingData: false, available };

  it('1. a stored registered choice wins', () => {
    expect(resolveLocale({ ...base, stored: 'en', browser: ['pl-PL'], hasExistingData: true })).toBe('en');
    expect(resolveLocale({ ...base, stored: 'pl', browser: ['en-US'] })).toBe('pl');
  });

  it.each(['', 'xx', 'EN', '"en"', 'null'])('ignores the garbage stored value %j', (stored) => {
    expect(resolveLocale({ ...base, stored, browser: ['en-US'] })).toBe('en');
  });

  it('2. existing pieces without a stored choice stay Polish', () => {
    expect(resolveLocale({ ...base, browser: ['en-US'], hasExistingData: true })).toBe('pl');
  });

  it('3. the first registered browser language', () => {
    expect(resolveLocale({ ...base, browser: ['en-GB'] })).toBe('en');
    expect(resolveLocale({ ...base, browser: ['EN'] })).toBe('en');
    expect(resolveLocale({ ...base, browser: ['de-DE', 'en-US', 'pl'] })).toBe('en');
    expect(resolveLocale({ ...base, browser: ['pl-PL', 'en-US'] })).toBe('pl');
  });

  it('4. otherwise the default (Polish)', () => {
    expect(resolveLocale({ ...base, browser: ['de-DE'] })).toBe('pl');
    expect(resolveLocale(base)).toBe('pl');
    expect(DEFAULT_LOCALE).toBe('pl');
  });
});
