import { describe, expect, it } from 'vitest';
import { LANGUAGE_KEY, loadLanguage, saveLanguage } from './preferences';

class MemoryStorage {
  data = new Map<string, string>();
  getItem(k: string): string | null {
    return this.data.get(k) ?? null;
  }
  setItem(k: string, v: string): void {
    this.data.set(k, v);
  }
}

const available = ['pl', 'en'];

describe('language preference', () => {
  it('saves under its own key and loads it back', () => {
    const s = new MemoryStorage();
    expect(loadLanguage(available, s)).toBeNull();
    saveLanguage('en', s);
    expect(LANGUAGE_KEY).toBe('kiedy-trymowac-lang');
    expect([...s.data]).toEqual([['kiedy-trymowac-lang', 'en']]);
    expect(loadLanguage(available, s)).toBe('en');
  });

  it.each(['', 'xx', 'EN', '"en"', '{"lang":"en"}'])('ignores the unknown value %j', (raw) => {
    const s = new MemoryStorage();
    s.setItem(LANGUAGE_KEY, raw);
    expect(loadLanguage(available, s)).toBeNull();
  });

  it('swallows storage errors', () => {
    const failing = {
      getItem: (): string | null => {
        throw new Error('denied');
      },
      setItem: (): void => {
        throw new Error('quota');
      },
    };
    expect(loadLanguage(available, failing)).toBeNull();
    expect(() => saveLanguage('en', failing)).not.toThrow();
  });
});
