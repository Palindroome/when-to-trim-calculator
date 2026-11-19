// Section 2 "Warunki": room temperature and humidity (optionally from a forecast), airflow, the night switch and the damp room.
import { AIRFLOWS } from '../../../domain/types';
import type { Messages } from '../../../i18n';
import type { AppContext } from '../../context';
import { byId, options } from '../../dom';
import { numberMessageMarkup } from '../../form';
import { toggleHeight } from '../../motion';
import { stepCard } from '../cards/cards';
import * as weatherFill from './weather';

/** `weatherHours`: the forecast window of the weather fill offered below the temperature and humidity; null for none. */
export function markup(m: Messages, weatherHours: number | null): string {
  const f = m.fields;
  const u = m.units;
  return stepCard(
    2,
    'climate',
    m.sections.conditions,
    `<div class="grid">
      <div><label for="temp">${f.temp}</label><div class="unit"><input id="temp" type="text" inputmode="decimal" autocomplete="off" value="20"><span>${u.celsius}</span></div>${numberMessageMarkup('temp')}</div>
      <div><label for="rh">${f.rh}</label><div class="unit"><input id="rh" type="text" inputmode="decimal" autocomplete="off" value="50"><span>${u.percent}</span></div>${numberMessageMarkup('rh')}</div>${weatherHours === null ? '' : `\n      ${weatherFill.markup(m, weatherHours)}`}
      <div class="full"><label for="air">${f.airflow}</label>
        <select id="air">
          ${options(AIRFLOWS, m.options.airflow, 'light')}
        </select></div>
      <div class="full">
        <label class="check"><input type="checkbox" id="night" role="switch"> ${f.night}</label>
      </div>
      <div class="night"><label for="ntemp">${f.nightTemp}</label><div class="unit"><input id="ntemp" type="text" inputmode="decimal" autocomplete="off" value="15"><span>${u.celsius}</span></div>${numberMessageMarkup('ntemp')}</div>
      <div class="night"><label for="nrh">${f.nightRh}</label><div class="unit"><input id="nrh" type="text" inputmode="decimal" autocomplete="off" value="60"><span>${u.percent}</span></div>${numberMessageMarkup('nrh')}</div>
      <div><label for="dtemp">${f.dampTemp}</label><div class="unit"><input id="dtemp" type="text" inputmode="decimal" autocomplete="off" value="15"><span>${u.celsius}</span></div>${numberMessageMarkup('dtemp')}</div>
      <div><label for="drh">${f.dampRh}</label><div class="unit"><input id="drh" type="text" inputmode="decimal" autocomplete="off" value="88"><span>${u.percent}</span></div>${numberMessageMarkup('drh')}</div>
    </div>`,
  );
}

export function mount(root: HTMLElement, ctx: AppContext): void {
  const night = byId<HTMLInputElement>('night');
  // the night temperature and humidity are shown only while the switch is on; flipping it expands or collapses them
  root.querySelectorAll('.night').forEach((e) => {
    e.classList.toggle('hide', !night.checked);
  });
  night.addEventListener('change', () => {
    root.querySelectorAll<HTMLElement>('.night').forEach((e) => {
      toggleHeight(e, night.checked);
    });
  });
  root.querySelector('#body-2')!.addEventListener('input', () => ctx.compute());
  weatherFill.mount(root, ctx);
}
