import { describe, expect, it } from 'vitest';
import { DEFAULT_PARAMS } from '../../../src/domain/params';
import { createFormatter } from '../../../src/i18n';
import { pl } from '../../../src/i18n/pl';
import type { StoredCover } from '../../../src/storage/covers';
import {
  checkCoverName,
  newCoverId,
  parsePercent,
  percentText,
  toCatalogCover,
} from '../../../src/ui/features/custom-covers/custom-covers';
import { coverLabel, coverPhrase } from '../../../src/ui/render';

const fmt = createFormatter(pl, DEFAULT_PARAMS.horizonHours / 24);
const BUILT_IN = Object.values(pl.covers.label);
const PAPER: StoredCover = {
  id: 'custom:abc',
  name: 'Torba papierowa',
  factor: 0.6,
  airflow: 'damped',
  preset: 'slight',
  icon: 'paperBag',
  created: 1,
};

describe('checkCoverName', () => {
  it('accepts a new name of 1 to 40 characters, trimmed', () => {
    expect(checkCoverName('Torba', BUILT_IN)).toBeNull();
    expect(checkCoverName('  x  ', BUILT_IN)).toBeNull();
    expect(checkCoverName('a'.repeat(40), BUILT_IN)).toBeNull();
  });

  it('rejects an empty or too long name', () => {
    expect(checkCoverName('', BUILT_IN)).toBe('empty');
    expect(checkCoverName('   ', BUILT_IN)).toBe('empty');
    expect(checkCoverName('a'.repeat(41), BUILT_IN)).toBe('tooLong');
  });

  it('rejects a name already in use, ignoring case and spaces', () => {
    expect(checkCoverName('Odkryta', BUILT_IN)).toBe('taken');
    expect(checkCoverName('  cały WOREK ', BUILT_IN)).toBe('taken');
    expect(checkCoverName('torba papierowa', [...BUILT_IN, 'Torba papierowa'])).toBe('taken');
  });
});

describe('parsePercent', () => {
  it('reads 1 to 100% as a factor, with a decimal comma or dot', () => {
    expect(parsePercent('15')).toBe(0.15);
    expect(parsePercent(' 12,5 ')).toBe(0.125);
    expect(parsePercent('12.5')).toBe(0.125);
    expect(parsePercent('1')).toBe(0.01);
    expect(parsePercent('100')).toBe(1);
  });

  it('rejects values outside 1–100 and text that is not a number', () => {
    for (const raw of ['0', '0,5', '101', '100,1', '-5', '', 'abc', '12abc', '1,2,3'])
      expect(parsePercent(raw)).toBeNull();
  });
});

describe('percentText', () => {
  it('shows a whole percentage without decimals and otherwise one', () => {
    expect(percentText(fmt, 0.6)).toBe('60');
    expect(percentText(fmt, 0.07)).toBe('7');
    expect(percentText(fmt, 0.155)).toBe('15,5');
  });
});

describe('newCoverId', () => {
  it('never repeats an existing id', () => {
    const base = newCoverId(1000, []);
    expect(base).toBe(`custom:${(1000).toString(36)}`);
    const taken = [{ ...PAPER, id: base }];
    const next = newCoverId(1000, taken);
    expect(next).not.toBe(base);
    expect(newCoverId(1000, [...taken, { ...PAPER, id: next }])).not.toBe(next);
  });
});

describe('a custom cover in the catalog', () => {
  it('is a studio cover with its own name, phrase and icon', () => {
    const c = toCatalogCover(PAPER);
    expect(c).toEqual({
      id: 'custom:abc',
      factor: 0.6,
      airflow: 'damped',
      environment: 'room',
      name: 'Torba papierowa',
      icon: 'paperBag',
    });
    expect(coverLabel(pl, c)).toBe('Torba papierowa');
    expect(pl.plan.single(coverPhrase(pl, c))).toBe('Użyj opatulenia „Torba papierowa” od razu.');
  });

  it('gets the neutral icon when its stored icon is unknown', () => {
    expect(toCatalogCover({ ...PAPER, icon: 'nope' }).icon).toBeUndefined();
  });

  it('leaves built-in labels and phrases unchanged', () => {
    const open = DEFAULT_PARAMS.covers[0]!;
    expect(coverLabel(pl, open)).toBe('Odkryta');
    expect(coverPhrase(pl, open)).toBe('zostaw odkrytą');
  });
});
