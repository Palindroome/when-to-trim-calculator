import type { Place } from '../domain/weather';

/** UI language chosen with the switch. Kept apart from `kiedy-trymowac-v1`, whose format stays unchanged. */
export const LANGUAGE_KEY = 'kiedy-trymowac-lang';
/** Colour scheme chosen with the switch; no key means "follow the system". Also read by the inline script in index.html. */
export const THEME_KEY = 'kiedy-trymowac-theme';
/** Point confirmed on the map for the weather forecast in "Warunki" (JSON `Place`, rounded coordinates). */
export const WEATHER_PLACE_KEY = 'kiedy-trymowac-weather-place';

export type Theme = 'light' | 'dark';

type KeyValueStorage = Pick<Storage, 'getItem' | 'setItem' | 'removeItem'>;

/** The stored language if it is one of `available`; storage errors and unknown values give null. */
export function loadLanguage(
  available: readonly string[],
  storage?: KeyValueStorage,
): string | null {
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

/** The stored weather place; null for none, broken JSON, an unexpected shape and storage errors. */
export function loadPlace(storage?: KeyValueStorage): Place | null {
  try {
    const raw = (storage ?? localStorage).getItem(WEATHER_PLACE_KEY);
    const p: unknown = raw === null ? null : JSON.parse(raw);
    if (typeof p !== 'object' || p === null) return null;
    const { name, lat, lon } = p as Record<string, unknown>;
    return typeof name === 'string' && Number.isFinite(lat) && Number.isFinite(lon)
      ? { name, lat: lat as number, lon: lon as number }
      : null;
  } catch {
    return null;
  }
}

export function savePlace(place: Place, storage?: KeyValueStorage): void {
  try {
    const { name, lat, lon } = place;
    (storage ?? localStorage).setItem(WEATHER_PLACE_KEY, JSON.stringify({ name, lat, lon }));
  } catch {
    // ignore quota / privacy-mode errors
  }
}

export function clearPlace(storage?: KeyValueStorage): void {
  try {
    (storage ?? localStorage).removeItem(WEATHER_PLACE_KEY);
  } catch {
    // ignore privacy-mode errors
  }
}
