import { pl, type Messages } from './pl';

export type { Messages } from './pl';
export { createFormatter, type Formatter } from './format';

/** Registered UI languages. Add new catalogs here (each must satisfy `Messages`). */
export const LOCALES: Record<string, Messages> = { pl };

export const DEFAULT_LOCALE = 'pl';

export function getMessages(locale: string = DEFAULT_LOCALE): Messages {
  return LOCALES[locale] ?? pl;
}
