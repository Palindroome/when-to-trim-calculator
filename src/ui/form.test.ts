import { afterEach, describe, expect, it, vi } from 'vitest';
import { parseNumber, readAllowedCovers, toLocalInput } from './form';

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
    vi.stubGlobal('document', { querySelectorAll: (sel: string) => (sel === 'input[data-cover]' ? boxes : []) });
    expect(readAllowedCovers()).toEqual(['partial', 'full', 'box']);
  });
});
