import { describe, expect, it } from 'vitest';
import {
  COVERS_KEY,
  LocalStorageCoverRepository,
  type StoredCover,
} from '../../../src/storage/covers';

const memory = (init: Record<string, string> = {}) => {
  const data = new Map(Object.entries(init));
  return {
    data,
    getItem: (k: string) => data.get(k) ?? null,
    setItem: (k: string, v: string) => void data.set(k, v),
  };
};

const PAPER: StoredCover = {
  id: 'custom:abc',
  name: 'Torba papierowa',
  factor: 0.6,
  airflow: 'damped',
  preset: 'slight',
  icon: 'paperBag',
  created: 1,
};

const load = (raw: string): StoredCover[] =>
  new LocalStorageCoverRepository(memory({ [COVERS_KEY]: raw })).load();

describe('LocalStorageCoverRepository', () => {
  it('reads no covers from a missing key, garbage, null or a non-array', () => {
    expect(new LocalStorageCoverRepository(memory()).load()).toEqual([]);
    for (const raw of ['{not json', 'null', '42', '"x"', '{}', '{"covers":42}', '{"covers":null}'])
      expect(load(raw)).toEqual([]);
  });

  it('round-trips covers under its own key and never writes kiedy-trymowac-v1', () => {
    const s = memory({ 'kiedy-trymowac-v1': '{"pieces":[],"x":1}' });
    const repo = new LocalStorageCoverRepository(s);
    repo.save([PAPER]);
    expect(JSON.parse(s.data.get(COVERS_KEY)!)).toEqual({ covers: [PAPER] });
    expect(repo.load()).toEqual([PAPER]);
    expect(s.data.get('kiedy-trymowac-v1')).toBe('{"pieces":[],"x":1}');
    expect([...s.data.keys()].sort()).toEqual([COVERS_KEY, 'kiedy-trymowac-v1'].sort());
  });

  it('skips unusable entries and keeps the first of duplicate ids', () => {
    const bad = [
      null,
      7,
      { ...PAPER, id: 'open' },
      { ...PAPER, id: 'custom:' },
      { ...PAPER, id: 'custom:"><b>' },
      { ...PAPER, id: undefined },
      { ...PAPER, name: 5 },
      { ...PAPER, factor: 0 },
      { ...PAPER, factor: 1.5 },
      { ...PAPER, factor: '0.5' },
      { ...PAPER, airflow: 'full' },
    ];
    const second = { ...PAPER, name: 'Druga' };
    const other = { ...PAPER, id: 'custom:def', factor: 1 };
    expect(load(JSON.stringify({ covers: [...bad, PAPER, second, other] }))).toEqual([
      PAPER,
      other,
    ]);
  });

  it('fills in a missing preset, icon or creation time instead of skipping the cover', () => {
    const { preset: _p, icon: _i, created: _c, ...bare } = PAPER;
    expect(load(JSON.stringify({ covers: [bare] }))).toEqual([
      { ...bare, preset: 'custom', icon: '', created: 0 },
    ]);
  });

  it('swallows storage errors', () => {
    const broken = {
      getItem: () => {
        throw new Error('denied');
      },
      setItem: () => {
        throw new Error('quota');
      },
    };
    const repo = new LocalStorageCoverRepository(broken);
    expect(repo.load()).toEqual([]);
    expect(() => repo.save([PAPER])).not.toThrow();
  });
});
