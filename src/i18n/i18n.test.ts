import { describe, expect, it } from 'vitest';
import { createFormatter } from './format';
import { getMessages, LOCALES } from './index';
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

describe('decimal', () => {
  it('uses a decimal comma', () => {
    expect(fmt.decimal(6, 1)).toBe('6,0');
    expect(fmt.decimal(1.005, 2)).toBe('1,00');
    expect(fmt.decimal(-4, 1)).toBe('-4,0');
  });
});

describe('catalog', () => {
  it('plan sentences', () => {
    expect(pl.plan.single('open')).toBe('Zostaw odkrytą od razu.');
    expect(pl.plan.twoPhase('partial', '3 h', 'śr 4.03 12:00', 'box')).toBe(
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
