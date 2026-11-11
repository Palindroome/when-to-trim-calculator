import { AIRFLOWS, BATS, CLAYS, COVERS, SHAPES, STAGES, WETNESS } from '../domain/types';
import type { Messages } from '../i18n';

export const QUICK_DAYS = [1, 2, 3, 5, 7] as const;

/** Quick choices for the throwing time, keys of `m.dateTime.presets`. */
export const THROWN_PRESETS = ['now', 'hourAgo', 'morning', 'lastEvening'] as const;
export type ThrownPreset = (typeof THROWN_PRESETS)[number];

const CHEVRON = (d: string): string =>
  `<svg viewBox="0 0 18 18" width="18" height="18" fill="none" stroke="currentColor" stroke-width="1.75" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true" focusable="false"><path d="${d}"/></svg>`;

/**
 * One date-time field: a day button that opens a calendar (Cally) in a dialog, a 24 h time text field
 * and quick-choice buttons. The chosen day key lives in the hidden `<id>-day`; the app fills the
 * button text and sets up the calendar. Every control is named "<field> <part>".
 */
function dateTimeField(m: Messages, id: 'thrown' | 'when', legend: string, chipsId: string, chips: string): string {
  const d = m.dateTime;
  return `<fieldset class="datetime">
        <legend id="${id}-legend">${legend}</legend>
        <div class="dt-row">
          <div class="dt-day"><label id="${id}-day-label" for="${id}-day-btn">${d.day}</label>
            <input id="${id}-day" type="hidden">
            <button type="button" class="day-btn" id="${id}-day-btn" aria-haspopup="dialog" aria-controls="${id}-cal" aria-labelledby="${id}-legend ${id}-day-label ${id}-day-text">
              <span id="${id}-day-text"></span>
              <svg viewBox="0 0 18 18" width="18" height="18" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true" focusable="false"><rect x="2.5" y="3.5" width="13" height="12" rx="1.5"/><path d="M2.5 7.5h13M6 2v3M12 2v3"/></svg>
            </button></div>
          <div class="dt-time"><label id="${id}-time-label" for="${id}-time">${d.time}</label>
            <input id="${id}-time" type="text" inputmode="numeric" autocomplete="off" placeholder="${d.timePlaceholder}" aria-labelledby="${id}-legend ${id}-time-label"></div>
        </div>
        <p class="field-msg hide" id="${id}-time-msg">${d.invalidTime}</p>
        <div class="chips" id="${chipsId}">
          ${chips}
        </div>
        <dialog class="calendar" id="${id}-cal" aria-labelledby="${id}-legend">
          <calendar-date id="${id}-calendar" locale="${m.lang}" first-day-of-week="1">
            <span slot="heading" id="${id}-cal-heading" aria-hidden="true"></span>
            <span slot="previous">${CHEVRON('M11 4 6 9l5 5')}<span class="vh">${d.previousMonth}</span></span>
            <span slot="next">${CHEVRON('m7 4 5 5-5 5')}<span class="vh">${d.nextMonth}</span></span>
            <calendar-month></calendar-month>
          </calendar-date>
        </dialog>
      </fieldset>`;
}

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

/** Check (ticked) and cross (unticked) icons of a cover pill; CSS shows the one matching the checkbox. */
const PILL_ICONS = ['on', 'off']
  .map(
    (k) =>
      `<svg class="ico ${k}" viewBox="0 0 14 14" width="14" height="14" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true" focusable="false">` +
      `<path d="${k === 'on' ? 'M2.5 7.5l3 3 6-7' : 'M3.5 3.5l7 7M10.5 3.5l-7 7'}"/></svg>`,
  )
  .join('');

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
    <div class="dates">
      ${dateTimeField(m, 'thrown', f.thrown, 'thrown-quick', THROWN_PRESETS.map((p) => `<button type="button" class="chip" data-preset="${p}" aria-pressed="false">${m.dateTime.presets[p]}</button>`).join('\n          '))}
      ${dateTimeField(m, 'when', f.when, 'quick', QUICK_DAYS.map((d) => `<button type="button" class="chip" data-d="${d}" aria-pressed="false">${m.quickDate(d)}</button>`).join('\n          '))}
    </div>
    <fieldset class="covers" id="covers">
      <legend>${m.covers.filterTitle}</legend>
      <div class="opts">
        ${COVERS.map((c) => `<label class="pill"><input type="checkbox" data-cover="${c}" checked><span class="face">${PILL_ICONS}${m.covers.label[c]}</span></label>`).join('\n        ')}
      </div>
      <p class="muted" id="covers-hint">${m.covers.filterHint}</p>
      <p class="muted hide" id="covers-last" aria-live="polite">${m.covers.filterLastOne}</p>
    </fieldset>
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
