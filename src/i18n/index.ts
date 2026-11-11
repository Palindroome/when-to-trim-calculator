import { en } from './en';
import { type Messages, pl } from './pl';

export { createFormatter, type Formatter } from './format';
export type { Messages } from './pl';

/** Registered UI languages. Add new catalogs here (each must satisfy `Messages`). */
export const LOCALES: Record<string, Messages> = { pl, en };

export const DEFAULT_LOCALE = 'pl';

export function getMessages(locale: string = DEFAULT_LOCALE): Messages {
  return LOCALES[locale] ?? pl;
}

export interface LocaleHints {
  /** language chosen earlier with the switch, if any */
  stored: string | null;
  /** browser languages in preference order (`navigator.languages`) */
  browser: readonly string[];
  /** saved pieces exist from before the language switch */
  hasExistingData: boolean;
  /** registered locale codes */
  available: readonly string[];
}

/**
 * Initial UI language: a stored choice, else Polish for existing users,
 * else the first browser language that is registered, else the default.
 */
export function resolveLocale({ stored, browser, hasExistingData, available }: LocaleHints): string {
  if (stored !== null && available.includes(stored)) return stored;
  if (hasExistingData) return DEFAULT_LOCALE;
  for (const tag of browser) {
    const primary = tag.toLowerCase().split('-')[0] ?? '';
    if (available.includes(primary)) return primary;
  }
  return DEFAULT_LOCALE;
}
