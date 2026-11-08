import { describe, expect, it } from 'vitest';
import { parseNumber, toLocalInput } from './form';

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

describe('toLocalInput', () => {
  it('formats local time for datetime-local', () => {
    expect(toLocalInput(new Date(2026, 0, 2, 3, 4))).toBe('2026-01-02T03:04');
  });
});
