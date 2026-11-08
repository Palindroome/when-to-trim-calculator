import { AIRFLOWS, BATS, CLAYS, SHAPES, STAGES, WETNESS } from '../domain/types';
import type { Messages } from '../i18n';

export const QUICK_DAYS = [1, 2, 3, 5, 7] as const;

const options = <K extends string>(order: readonly K[], labels: Record<K, string>, selected?: K): string =>
  order
    .map((k) => `<option value="${k}"${k === selected ? ' selected' : ''}>${labels[k]}</option>`)
    .join('\n          ');

/** Static page structure (everything except the dynamic result / list areas). */
export function renderShell(m: Messages): string {
  const f = m.fields;
  const u = m.units;
  const o = m.options;
  return `
  <h1>${m.heading}</h1>
  <p class="lead">${m.lead}</p>

  <section class="card">
    <h2><span class="n">1</span>${m.sections.piece}</h2>
    <div class="grid">
      <div class="full"><label for="name">${f.name}</label><input id="name" placeholder="${f.namePlaceholder}"></div>
      <div><label for="mass">${f.mass}</label><div class="unit"><input id="mass" type="number" inputmode="decimal" value="500" min="20"><span>${u.grams}</span></div></div>
      <div><label for="shape">${f.shape}</label>
        <select id="shape">
          ${options(SHAPES, o.shape)}
        </select></div>
      <div><label for="wall">${f.wall}</label><div class="unit"><input id="wall" type="number" inputmode="decimal" value="6" min="2" max="30"><span>${u.millimetres}</span></div></div>
      <div><label for="base">${f.base}</label><div class="unit"><input id="base" type="number" inputmode="decimal" value="9" min="2" max="40"><span>${u.millimetres}</span></div></div>
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
  </section>

  <section class="card">
    <h2><span class="n">2</span>${m.sections.conditions}</h2>
    <div class="grid">
      <div><label for="temp">${f.temp}</label><div class="unit"><input id="temp" type="number" inputmode="decimal" value="20"><span>${u.celsius}</span></div></div>
      <div><label for="rh">${f.rh}</label><div class="unit"><input id="rh" type="number" inputmode="decimal" value="50" min="5" max="99"><span>${u.percent}</span></div></div>
      <div class="full"><label for="air">${f.airflow}</label>
        <select id="air">
          ${options(AIRFLOWS, o.airflow, 'light')}
        </select></div>
      <div class="full">
        <label class="check"><input type="checkbox" id="night"> ${f.night}</label>
      </div>
      <div class="night"><label for="ntemp">${f.nightTemp}</label><div class="unit"><input id="ntemp" type="number" inputmode="decimal" value="15"><span>${u.celsius}</span></div></div>
      <div class="night"><label for="nrh">${f.nightRh}</label><div class="unit"><input id="nrh" type="number" inputmode="decimal" value="60"><span>${u.percent}</span></div></div>
      <div><label for="dtemp">${f.dampTemp}</label><div class="unit"><input id="dtemp" type="number" inputmode="decimal" value="15"><span>${u.celsius}</span></div></div>
      <div><label for="drh">${f.dampRh}</label><div class="unit"><input id="drh" type="number" inputmode="decimal" value="88"><span>${u.percent}</span></div></div>
    </div>
  </section>

  <section class="card">
    <h2><span class="n">3</span>${m.sections.schedule}</h2>
    <div class="grid">
      <div><label for="thrown">${f.thrown}</label><input id="thrown" type="datetime-local"></div>
      <div><label for="when">${f.when}</label><input id="when" type="datetime-local"></div>
    </div>
    <div class="chips" id="quick">
      ${QUICK_DAYS.map((d) => `<button class="chip" data-d="${d}">${m.quickDate(d)}</button>`).join('\n      ')}
    </div>
  </section>

  <section id="result"></section>

  <section class="card">
    <h2><span class="n">4</span>${m.sections.weight}</h2>
    <p class="muted" style="margin:-4px 0 10px">${m.weightHint}</p>
    <div class="grid">
      <div><label for="mnow">${f.massNow}</label><div class="unit"><input id="mnow" type="number" inputmode="decimal" placeholder="${f.massNowPlaceholder}"><span>${u.grams}</span></div></div>
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
