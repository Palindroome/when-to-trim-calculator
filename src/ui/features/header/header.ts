// Page header: the heading, the language switch and the theme switch.
import type { Messages } from '../../../i18n';
import type { AppContext } from '../../context';
import { closest } from '../../dom';

/** Choices of the theme switch; `system` means no `data-theme` on <html> and no stored value. */
const THEME_CHOICES = ['system', 'light', 'dark'] as const;
export type ThemeChoice = (typeof THEME_CHOICES)[number];

const THEME_ICONS: Record<ThemeChoice, string> = {
  system: '<rect x="2" y="3" width="14" height="10" rx="1"/><path d="M6 16h6M9 13v3"/>',
  light:
    '<circle cx="9" cy="9" r="3.5"/><path d="M9 1.5v2M9 14.5v2M1.5 9h2M14.5 9h2M3.7 3.7l1.4 1.4M12.9 12.9l1.4 1.4M3.7 14.3l1.4-1.4M12.9 5.1l1.4-1.4"/>',
  dark: '<path d="M15.5 10.5A6.5 6.5 0 1 1 7.5 2.5a5 5 0 0 0 8 8z"/>',
};

/** `PL | EN` segmented control; one button per registered locale code. */
function languageSwitch(m: Messages, locales: readonly string[]): string {
  const names: Record<string, string> = m.language.names;
  const buttons = locales.map(
    (code) =>
      `<button type="button" data-lang="${code}" lang="${code}" aria-label="${names[code] ?? code}" aria-pressed="${code === m.lang}">${code.toUpperCase()}</button>`,
  );
  return `<div class="seg" role="group" aria-label="${m.language.label}">${buttons.join('')}</div>`;
}

/** `System | Light | Dark` segmented control with icons; names come from the catalog. */
function themeSwitch(m: Messages, current: ThemeChoice): string {
  const buttons = THEME_CHOICES.map(
    (c) =>
      `<button type="button" data-theme-choice="${c}" aria-label="${m.theme[c]}" title="${m.theme[c]}" aria-pressed="${c === current}">` +
      `<svg viewBox="0 0 18 18" width="18" height="18" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true" focusable="false">${THEME_ICONS[c]}</svg></button>`,
  );
  return `<div class="seg" role="group" aria-label="${m.theme.label}">${buttons.join('')}</div>`;
}

export function markup(m: Messages, locales: readonly string[], theme: ThemeChoice): string {
  return `<header class="masthead">
    <h1>${m.heading}</h1>
    <div class="toolbar">${languageSwitch(m, locales)}${themeSwitch(m, theme)}</div>
  </header>`;
}

/** Applies the choice at once through `data-theme` on <html>; no re-render, nothing is recomputed. */
function switchTheme(root: HTMLElement, ctx: AppContext, choice: ThemeChoice): void {
  const theme = choice === 'system' ? null : choice;
  if (theme) document.documentElement.dataset.theme = theme;
  else delete document.documentElement.dataset.theme;
  root.querySelectorAll<HTMLButtonElement>('[data-theme-choice]').forEach((b) => {
    b.setAttribute('aria-pressed', String(b.dataset.themeChoice === choice));
  });
  ctx.setTheme(theme);
}

export function mount(root: HTMLElement, ctx: AppContext): void {
  root.querySelector('.masthead')!.addEventListener('click', (e) => {
    const b = closest(e, 'button');
    if (b?.dataset.lang !== undefined) ctx.switchLanguage(b.dataset.lang);
    else if (b?.dataset.themeChoice) switchTheme(root, ctx, b.dataset.themeChoice as ThemeChoice);
  });
}
