/** UI language chosen with the switch. Kept apart from `kiedy-trymowac-v1`, whose format stays unchanged. */
export const LANGUAGE_KEY = 'kiedy-trymowac-lang';

type KeyValueStorage = Pick<Storage, 'getItem' | 'setItem'>;

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
