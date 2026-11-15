import { describe, expect, it } from 'vitest';
import {
  SESSION_KEY,
  type SessionSnapshot,
  SessionStorageSessionStore,
} from '../../../src/storage/session';

const memory = (init: Record<string, string> = {}) => {
  const data = new Map(Object.entries(init));
  return {
    data,
    getItem: (k: string) => data.get(k) ?? null,
    setItem: (k: string, v: string) => void data.set(k, v),
  };
};

const SNAPSHOT: SessionSnapshot = {
  screen: 'calculator',
  piecesListed: false,
  form: {
    fields: [
      { id: 'mass', value: '700', checked: false },
      { id: 'night', value: 'on', checked: true },
    ],
    dates: { quick: '3', thrownPreset: undefined },
    allowed: ['open', 'box'],
  },
  wizardStep: 1,
  scrollY: 420,
};

describe('SessionStorageSessionStore', () => {
  it('reads null when nothing is stored', () => {
    expect(new SessionStorageSessionStore(memory()).load()).toBeNull();
  });

  it('round-trips a snapshot under its own key, leaving other keys alone', () => {
    const s = memory({ 'kiedy-trymowac-v1': '{"pieces":[]}' });
    const store = new SessionStorageSessionStore(s);
    store.save(SNAPSHOT);
    expect(store.load()).toEqual(SNAPSHOT);
    expect(s.data.has(SESSION_KEY)).toBe(true);
    expect(s.data.get('kiedy-trymowac-v1')).toBe('{"pieces":[]}');
  });

  it('keeps a closed wizard and the welcome screen with its list expanded', () => {
    const store = new SessionStorageSessionStore(memory());
    const welcome = {
      ...SNAPSHOT,
      screen: 'welcome',
      piecesListed: true,
      wizardStep: null,
    } as const;
    store.save(welcome);
    expect(store.load()).toEqual(welcome);
  });

  it('treats unparseable or malformed values as nothing saved', () => {
    const bad: unknown[] = [
      null,
      42,
      [],
      { ...SNAPSHOT, screen: 'other' },
      { ...SNAPSHOT, piecesListed: 'yes' },
      { ...SNAPSHOT, wizardStep: -1 },
      { ...SNAPSHOT, wizardStep: 1.5 },
      { ...SNAPSHOT, scrollY: 'top' },
      { ...SNAPSHOT, form: null },
      { ...SNAPSHOT, form: { ...SNAPSHOT.form, fields: [{ id: 'mass' }] } },
      { ...SNAPSHOT, form: { ...SNAPSHOT.form, dates: { quick: 3 } } },
      { ...SNAPSHOT, form: { ...SNAPSHOT.form, allowed: [1] } },
    ];
    for (const v of ['', '{', 'soon', ...bad.map((b) => JSON.stringify(b))]) {
      expect(new SessionStorageSessionStore(memory({ [SESSION_KEY]: v })).load()).toBeNull();
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
    const store = new SessionStorageSessionStore(broken);
    expect(store.load()).toBeNull();
    expect(() => store.save(SNAPSHOT)).not.toThrow();
  });
});
