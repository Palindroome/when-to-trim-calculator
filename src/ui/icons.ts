// Decorative inline SVG icons: stroke drawings that take their colour from the surrounding text.
import type { CoverId } from '../domain/covers';

interface IconDef {
  /** the SVG's child elements, drawn in a `size`×`size` box */
  body: string;
  /** width, height and viewBox size in px (default 18) */
  size?: number;
  /** stroke width (default 1.5) */
  stroke?: number;
}

const ICONS = {
  // theme switch
  system: { body: '<rect x="2" y="3" width="14" height="10" rx="1"/><path d="M6 16h6M9 13v3"/>' },
  light: {
    body: '<circle cx="9" cy="9" r="3.5"/><path d="M9 1.5v2M9 14.5v2M1.5 9h2M14.5 9h2M3.7 3.7l1.4 1.4M12.9 12.9l1.4 1.4M3.7 14.3l1.4-1.4M12.9 5.1l1.4-1.4"/>',
  },
  dark: { body: '<path d="M15.5 10.5A6.5 6.5 0 1 1 7.5 2.5a5 5 0 0 0 8 8z"/>' },
  // date-time pickers
  calendar: {
    body: '<rect x="2.5" y="3.5" width="13" height="12" rx="1.5"/><path d="M2.5 7.5h13M6 2v3M12 2v3"/>',
  },
  chevronLeft: { body: '<path d="M11 4 6 9l5 5"/>', stroke: 1.75 },
  chevronRight: { body: '<path d="m7 4 5 5-5 5"/>', stroke: 1.75 },
  // cover pills (ticked / unticked) and the save button
  pillOn: { body: '<path d="M2.5 7.5l3 3 6-7"/>', size: 14, stroke: 2 },
  pillOff: { body: '<path d="M3.5 3.5l7 7M10.5 3.5l-7 7"/>', size: 14, stroke: 2 },
  saved: { body: '<path d="M3 8.5l3 3 7-7"/>', size: 16, stroke: 2 },
  // section headings and actions
  vessel: {
    body: '<path d="M5.5 2.5h7M7 2.5v2C4.5 5.5 3 7.5 3 10.5c0 3 2.5 5 6 5s6-2 6-5c0-3-1.5-5-4-6v-2"/>',
  },
  climate: {
    body: '<path d="M5 10.6V3.5a1.5 1.5 0 0 1 3 0v7.1a2.75 2.75 0 1 1-3 0z"/><path d="M13 8.5s-2.5 2.8-2.5 4.5a2.5 2.5 0 0 0 5 0c0-1.7-2.5-4.5-2.5-4.5z"/>',
  },
  clock: { body: '<circle cx="9" cy="9" r="6.5"/><path d="M9 5.5V9l2.5 1.5"/>' },
  scale: {
    body: '<path d="M9 2.5v13M5.5 15.5h7M3.5 5h11M3.5 5l-2 5a2 2 0 0 0 4 0zM14.5 5l-2 5a2 2 0 0 0 4 0z"/>',
  },
  notebook: {
    body: '<rect x="3.5" y="2.5" width="11" height="13" rx="1.5"/><path d="M6.5 6h5M6.5 9h5M6.5 12h3"/>',
  },
  plus: { body: '<path d="M9 3.5v11M3.5 9h11"/>' },
  info: { body: '<circle cx="9" cy="9" r="6.5"/><path d="M9 8.5v4M9 5.5v.01"/>' },
  // result
  target: { body: '<circle cx="9" cy="9" r="6.5"/><circle cx="9" cy="9" r="3"/>' },
  warning: { body: '<path d="M9 2.5 1.75 15h14.5zM9 7v3.5M9 13v.01"/>' },
  chart: { body: '<path d="M3 15.5h12M5 15.5V10M9 15.5V4M13 15.5V7.5"/>' },
  // covering methods
  bowl: { body: '<path d="M2.5 8.5h13a6.5 6.5 0 0 1-13 0z"/>' },
  bagLoose: { body: '<path d="M2.5 10.5h13a6.5 5 0 0 1-13 0zM2.5 10.5C3 6 7 3.5 12 4.5"/>' },
  bag: {
    body: '<path d="M7 4.5 5.5 2.5h7L11 4.5M7 4.5h4M7 4.5C4 6 2.5 9 2.5 11.5a4 4 0 0 0 4 4h5a4 4 0 0 0 4-4c0-2.5-1.5-5.5-4.5-7"/>',
  },
  box: { body: '<path d="M2.5 6 9 2.5 15.5 6v7L9 16.5 2.5 13zM2.5 6 9 9.5 15.5 6M9 9.5v7"/>' },
  dampRoom: {
    body: '<path d="M2.5 8 9 2.5 15.5 8v7.5h-13z"/><path d="M9 8.5s-2 2.2-2 3.5a2 2 0 0 0 4 0c0-1.3-2-3.5-2-3.5z"/>',
  },
  cover: { body: '<path d="M9 2.5 2 6.5l7 4 7-4zM2 10l7 4 7-4"/>' },
} satisfies Record<string, IconDef>;

export type IconName = keyof typeof ICONS;
export const ICON_NAMES = Object.keys(ICONS) as IconName[];

/** One decorative icon as inline SVG, hidden from assistive technology; `cls` becomes its class. */
export function icon(name: IconName, cls?: string): string {
  const { body, size = 18, stroke = 1.5 }: IconDef = ICONS[name];
  return (
    `<svg${cls ? ` class="${cls}"` : ''} viewBox="0 0 ${size} ${size}" width="${size}" height="${size}" fill="none" stroke="currentColor" stroke-width="${stroke}" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true" focusable="false">` +
    `${body}</svg>`
  );
}

/** Icons of the built-in covers; any other cover in the catalog gets the neutral `cover` icon. */
const COVER_ICONS: Partial<Record<CoverId, IconName>> = {
  open: 'bowl',
  partial: 'bagLoose',
  full: 'bag',
  box: 'box',
  damp: 'dampRoom',
};

export const coverIcon = (id: CoverId, cls?: string): string =>
  icon(COVER_ICONS[id] ?? 'cover', cls);
