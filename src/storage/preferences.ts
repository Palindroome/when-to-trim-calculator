/** UI language chosen with the switch. Kept apart from `kiedy-trymowac-v1`, whose format stays unchanged. */
export const LANGUAGE_KEY = 'kiedy-trymowac-lang';
/** Colour scheme chosen with the switch; no key means "follow the system". Also read by the inline script in index.html. */
export const THEME_KEY = 'kiedy-trymowac-theme';

export type Theme = 'light' | 'dark';

type KeyValueStorage = Pick<Storage, 'getItem' | 'setItem' | 'removeItem'>;

/** The stored language if it is one of `available`; storage errors and unknown values give null. */
export function loadLanguage(available: readonly string[], storage?: KeyValueStorage): string | null {
  try {
    const code = (storage ?? localStorage).getItem(LANGUAGE_KEY);
    return code !== null && available.includes(code) ? code : null;
  } catch {
    return null;
  }
}

export function saveLanguage(code: string, storage?: KeyValueStorage): void {
  try {
    (storage ?? localStorage).setItem(LANGUAGE_KEY, code);
  } catch {
    // ignore quota / privacy-mode errors
  }
}

/** The stored theme; null (follow the system) for no choice, unknown values and storage errors. */
export function loadTheme(storage?: KeyValueStorage): Theme | null {
  try {
    const value = (storage ?? localStorage).getItem(THEME_KEY);
    return value === 'light' || value === 'dark' ? value : null;
  } catch {
    return null;
  }
}

/** Stores `light` / `dark`; null (follow the system) removes the key. */
export function saveTheme(theme: Theme | null, storage?: KeyValueStorage): void {
  try {
    const s = storage ?? localStorage;
    if (theme === null) s.removeItem(THEME_KEY);
    else s.setItem(THEME_KEY, theme);
  } catch {
    // ignore quota / privacy-mode errors
  }
}
