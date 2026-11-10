import { AIRFLOWS, BATS, CLAYS, SHAPES, STAGES, WETNESS } from '../domain/types';
import type { Messages } from '../i18n';

export const QUICK_DAYS = [1, 2, 3, 5, 7] as const;

const options = <K extends string>(order: readonly K[], labels: Record<K, string>, selected?: K): string =>
  order
    .map((k) => `<option value="${k}"${k === selected ? ' selected' : ''}>${labels[k]}</option>`)
    .join('\n          ');

/** `PL | EN` segmented control; one button per registered locale code. */
function languageSwitch(m: Messages, locales: readonly string[]): string {
  const names: Record<string, string> = m.language.names;
  const buttons = locales.map(
    (code) =>
      `<button type="button" data-lang="${code}" lang="${code}" aria-label="${names[code] ?? code}" aria-pressed="${code === m.lang}">${code.toUpperCase()}</button>`,
  );
  return `<div class="seg" role="group" aria-label="${m.language.label}">${buttons.join('')}</div>`;
}

/** Choices of the theme switch; `system` means no `data-theme` on <html> and no stored value. */
export const THEME_CHOICES = ['system', 'light', 'dark'] as const;
export type ThemeChoice = (typeof THEME_CHOICES)[number];

const THEME_ICONS: Record<ThemeChoice, string> = {
  system: '<rect x="2" y="3" width="14" height="10" rx="1"/><path d="M6 16h6M9 13v3"/>',
  light:
    '<circle cx="9" cy="9" r="3.5"/><path d="M9 1.5v2M9 14.5v2M1.5 9h2M14.5 9h2M3.7 3.7l1.4 1.4M12.9 12.9l1.4 1.4M3.7 14.3l1.4-1.4M12.9 5.1l1.4-1.4"/>',
  dark: '<path d="M15.5 10.5A6.5 6.5 0 1 1 7.5 2.5a5 5 0 0 0 8 8z"/>',
};

/** `System | Light | Dark` segmented control with icons; names come from the catalog. */
function themeSwitch(m: Messages, current: ThemeChoice): string {
  const buttons = THEME_CHOICES.map(
    (c) =>
      `<button type="button" data-theme-choice="${c}" aria-label="${m.theme[c]}" title="${m.theme[c]}" aria-pressed="${c === current}">` +
      `<svg viewBox="0 0 18 18" width="18" height="18" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true" focusable="false">${THEME_ICONS[c]}</svg></button>`,
  );
  return `<div class="seg" role="group" aria-label="${m.theme.label}">${buttons.join('')}</div>`;
}

/** Static page structure (everything except the dynamic result / list areas). */
export function renderShell(m: Messages, locales: readonly string[], theme: ThemeChoice): string {
  const f = m.fields;
  const u = m.units;
  const o = m.options;
  return `
  <header class="masthead">
    <h1>${m.heading}</h1>
    <div class="toolbar">${languageSwitch(m, locales)}${themeSwitch(m, theme)}</div>
  </header>
  <p class="lead">${m.lead}</p>
  <div class="wizard-bar">
    <p class="wizard-progress wizard-only" id="wizard-progress" aria-live="polite"></p>
    <button type="button" class="ghost wizard-only" id="wizard-skip">${m.wizard.skip}</button>
    <button type="button" class="ghost full-only" id="wizard-open">${m.wizard.reopen}</button>
  </div>

  <section class="card" data-step>
    <div class="card-head">
      <h2><span class="n">1</span>${m.sections.piece}</h2>
      <button type="button" class="ghost toggle compact-only" aria-expanded="true" aria-controls="body-1"></button>
    </div>
    <p class="summary compact-only"></p>
    <div class="card-body" id="body-1">
    <div class="grid">
      <div class="full"><label for="name">${f.name}</label><input id="name" placeholder="${f.namePlaceholder}"></div>
      <div><label for="mass">${f.mass}</label><div class="unit"><input id="mass" type="text" inputmode="decimal" autocomplete="off" value="500"><span>${u.grams}</span></div></div>
      <div><label for="shape">${f.shape}</label>
        <select id="shape">
          ${options(SHAPES, o.shape)}
        </select></div>
      <div><label for="wall">${f.wall}</label><div class="unit"><input id="wall" type="text" inputmode="decimal" autocomplete="off" value="6"><span>${u.millimetres}</span></div></div>
      <div><label for="base">${f.base}</label><div class="unit"><input id="base" type="text" inputmode="decimal" autocomplete="off" value="9"><span>${u.millimetres}</span></div></div>
      <div><label for="clay">${f.clay}</label>
        <select id="clay">
          ${options(CLAYS, o.clay, 'stone')}
        </select></div>
      <div><label for="bat">${f.bat}</label>
        <select id="bat">
          ${options(BATS, o.bat, 'wood')}
        </select></div>
      <div><label for="wet">${f.wetness}</label>
        <select id="wet">
          ${options(WETNESS, o.wetness, 'normal')}
        </select></div>
      <div><label for="stage">${f.stage}</label>
        <select id="stage">
          ${options(STAGES, o.stage, 'trim')}
        </select></div>
    </div>
    </div>
  </section>

  <section class="card" data-step>
    <div class="card-head">
      <h2><span class="n">2</span>${m.sections.conditions}</h2>
      <button type="button" class="ghost toggle compact-only" aria-expanded="true" aria-controls="body-2"></button>
    </div>
    <p class="summary compact-only"></p>
    <div class="card-body" id="body-2">
    <div class="grid">
      <div><label for="temp">${f.temp}</label><div class="unit"><input id="temp" type="text" inputmode="decimal" autocomplete="off" value="20"><span>${u.celsius}</span></div></div>
      <div><label for="rh">${f.rh}</label><div class="unit"><input id="rh" type="text" inputmode="decimal" autocomplete="off" value="50"><span>${u.percent}</span></div></div>
      <div class="full"><label for="air">${f.airflow}</label>
        <select id="air">
          ${options(AIRFLOWS, o.airflow, 'light')}
        </select></div>
      <div class="full">
        <label class="check"><input type="checkbox" id="night" role="switch"> ${f.night}</label>
      </div>
      <div class="night"><label for="ntemp">${f.nightTemp}</label><div class="unit"><input id="ntemp" type="text" inputmode="decimal" autocomplete="off" value="15"><span>${u.celsius}</span></div></div>
      <div class="night"><label for="nrh">${f.nightRh}</label><div class="unit"><input id="nrh" type="text" inputmode="decimal" autocomplete="off" value="60"><span>${u.percent}</span></div></div>
      <div><label for="dtemp">${f.dampTemp}</label><div class="unit"><input id="dtemp" type="text" inputmode="decimal" autocomplete="off" value="15"><span>${u.celsius}</span></div></div>
      <div><label for="drh">${f.dampRh}</label><div class="unit"><input id="drh" type="text" inputmode="decimal" autocomplete="off" value="88"><span>${u.percent}</span></div></div>
    </div>
    </div>
  </section>

  <section class="card" data-step>
    <div class="card-head">
      <h2><span class="n">3</span>${m.sections.schedule}</h2>
      <button type="button" class="ghost toggle compact-only" aria-expanded="true" aria-controls="body-3"></button>
    </div>
    <p class="summary compact-only"></p>
    <div class="card-body" id="body-3">
    <div class="grid dates">
      <div><label for="thrown">${f.thrown}</label><input id="thrown" type="datetime-local"></div>
      <div><label for="when">${f.when}</label><input id="when" type="datetime-local"></div>
    </div>
    <div class="chips" id="quick">
      ${QUICK_DAYS.map((d) => `<button class="chip" data-d="${d}">${m.quickDate(d)}</button>`).join('\n      ')}
    </div>
    </div>
  </section>

  <section id="result"></section>
  <nav class="wizard-nav wizard-only" aria-label="${m.wizard.label}">
    <button type="button" class="ghost" id="wizard-back">${m.wizard.back}</button>
    <button type="button" class="main" id="wizard-next">${m.wizard.next}</button>
  </nav>

  <section class="card">
    <h2><span class="n">4</span>${m.sections.weight}</h2>
    <p class="muted hint">${m.weightHint}</p>
    <div class="grid">
      <div><label for="mnow">${f.massNow}</label><div class="unit"><input id="mnow" type="text" inputmode="decimal" autocomplete="off" placeholder="${f.massNowPlaceholder}"><span>${u.grams}</span></div></div>
      <div><label for="wnow">${f.coverSoFar}</label>
        <select id="wnow"></select></div>
    </div>
    <div id="wout"></div>
  </section>

  <section class="card">
    <h2><span class="n">5</span>${m.sections.pieces}</h2>
    <div id="pieces"></div>
    <div id="calib"></div>
  </section>

  <section class="card">
    <details>
      <summary>${m.explainer.summary}</summary>
      <ul>
        ${m.explainer.itemsHtml.map((li) => `<li>${li}</li>`).join('\n        ')}
      </ul>
    </details>
  </section>
`;
}
