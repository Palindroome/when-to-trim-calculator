import { describe, expect, it } from 'vitest';
import { LocalStorageWizardStore, WIZARD_KEY } from './wizard';

const memory = (init: Record<string, string> = {}) => {
  const data = new Map(Object.entries(init));
  return { data, getItem: (k: string) => data.get(k) ?? null, setItem: (k: string, v: string) => void data.set(k, v) };
};

describe('LocalStorageWizardStore', () => {
  it('reads null when nothing is stored', () => {
    expect(new LocalStorageWizardStore(memory()).load()).toBeNull();
  });

  it('round-trips the outcome under its own key, leaving other keys alone', () => {
    const s = memory({ 'kiedy-trymowac-v1': '{"pieces":[]}' });
    const store = new LocalStorageWizardStore(s);
    store.save('skipped');
    expect(store.load()).toBe('skipped');
    expect(s.data.get(WIZARD_KEY)).toBe('skipped');
    expect(s.data.get('kiedy-trymowac-v1')).toBe('{"pieces":[]}');
  });

  it('treats unknown values as not done', () => {
    expect(new LocalStorageWizardStore(memory({ [WIZARD_KEY]: 'maybe' })).load()).toBeNull();
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
    const store = new LocalStorageWizardStore(broken);
    expect(store.load()).toBeNull();
    expect(() => store.save('done')).not.toThrow();
  });
});
