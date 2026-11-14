/** Element by id; the page structure is static, so a missing id is a programming error. */
export function byId<T extends HTMLElement = HTMLElement>(id: string): T {
  const el = document.getElementById(id);
  if (!el) throw new Error(`#${id} not found`);
  return el as T;
}

const ENTITIES: Record<string, string> = { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' };

/** Escapes text for insertion into HTML. */
export const esc = (s: unknown): string => String(s).replace(/[&<>"]/g, (c) => ENTITIES[c]!);

/** `<option>`s of a select, in `order`, labelled from the catalog. */
export const options = <K extends string>(order: readonly K[], labels: Record<K, string>, selected?: K): string =>
  order.map((k) => `<option value="${k}"${k === selected ? ' selected' : ''}>${labels[k]}</option>`).join('\n          ');

/** The closest element matching `selector` from where an event happened, or null. */
export const closest = <T extends Element = HTMLElement>(e: Event, selector: string): T | null =>
  e.target instanceof Element ? e.target.closest<T>(selector) : null;
