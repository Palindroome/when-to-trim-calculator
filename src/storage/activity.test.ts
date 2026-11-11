import { describe, expect, it } from 'vitest';
import { ACTIVITY_KEY, LocalStorageActivityStore } from './activity';

const memory = (init: Record<string, string> = {}) => {
  const data = new Map(Object.entries(init));
  return { data, getItem: (k: string) => data.get(k) ?? null, setItem: (k: string, v: string) => void data.set(k, v) };
};

describe('LocalStorageActivityStore', () => {
  it('reads null when nothing is stored', () => {
    expect(new LocalStorageActivityStore(memory()).load()).toBeNull();
  });

  it('round-trips epoch ms under its own key, leaving other keys alone', () => {
    const s = memory({ 'kiedy-trymowac-v1': '{"pieces":[]}' });
    const store = new LocalStorageActivityStore(s);
    store.save(1772611200000);
    expect(store.load()).toBe(1772611200000);
    expect(s.data.get(ACTIVITY_KEY)).toBe('1772611200000');
    expect(s.data.get('kiedy-trymowac-v1')).toBe('{"pieces":[]}');
  });

  it('treats garbage as nothing recorded', () => {
    for (const v of ['', 'soon', '12abc', '-5', '1.5', 'NaN']) {
      expect(new LocalStorageActivityStore(memory({ [ACTIVITY_KEY]: v })).load()).toBeNull();
    }
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
    const store = new LocalStorageActivityStore(broken);
    expect(store.load()).toBeNull();
    expect(() => store.save(1)).not.toThrow();
  });
});
