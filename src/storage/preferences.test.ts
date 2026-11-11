import { describe, expect, it } from 'vitest';
import { LANGUAGE_KEY, loadLanguage, loadTheme, saveLanguage, saveTheme, THEME_KEY } from './preferences';

class MemoryStorage {
  data = new Map<string, string>();
  getItem(k: string): string | null {
    return this.data.get(k) ?? null;
  }
  setItem(k: string, v: string): void {
    this.data.set(k, v);
  }
  removeItem(k: string): void {
    this.data.delete(k);
  }
}

const failing = {
  getItem: (): string | null => {
    throw new Error('denied');
  },
  setItem: (): void => {
    throw new Error('quota');
  },
  removeItem: (): void => {
    throw new Error('denied');
  },
};

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
    expect(loadLanguage(available, failing)).toBeNull();
    expect(() => saveLanguage('en', failing)).not.toThrow();
  });
});

describe('theme preference', () => {
  it('saves light / dark under its own key; null (system) removes it', () => {
    const s = new MemoryStorage();
    s.setItem(LANGUAGE_KEY, 'en');
    expect(loadTheme(s)).toBeNull();
    saveTheme('dark', s);
    expect(THEME_KEY).toBe('kiedy-trymowac-theme');
    expect(s.data.get(THEME_KEY)).toBe('dark');
    expect(loadTheme(s)).toBe('dark');
    saveTheme('light', s);
    expect(loadTheme(s)).toBe('light');
    saveTheme(null, s);
    expect([...s.data]).toEqual([[LANGUAGE_KEY, 'en']]);
    expect(loadTheme(s)).toBeNull();
  });

  it.each(['', 'system', 'Dark', '"dark"', 'auto'])('ignores the unknown value %j', (raw) => {
    const s = new MemoryStorage();
    s.setItem(THEME_KEY, raw);
    expect(loadTheme(s)).toBeNull();
  });

  it('swallows storage errors', () => {
    expect(loadTheme(failing)).toBeNull();
    expect(() => saveTheme('dark', failing)).not.toThrow();
    expect(() => saveTheme(null, failing)).not.toThrow();
  });
});
