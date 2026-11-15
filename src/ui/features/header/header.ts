// Page header: the heading, the language switch and the theme switch.
import type { Messages } from '../../../i18n';
import type { AppContext } from '../../context';
import { closest } from '../../dom';
import { icon } from '../../icons';

/** Choices of the theme switch; `system` means no `data-theme` on <html> and no stored value. */
const THEME_CHOICES = ['system', 'light', 'dark'] as const;
export type ThemeChoice = (typeof THEME_CHOICES)[number];

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
      `${icon(c)}</button>`,
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
