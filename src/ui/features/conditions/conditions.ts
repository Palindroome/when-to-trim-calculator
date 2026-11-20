// Section 2 "Warunki": room temperature and humidity (optionally from a forecast), airflow, the night switch and the damp room.
import { AIRFLOWS } from '../../../domain/types';
import type { Messages } from '../../../i18n';
import type { AppContext } from '../../context';
import { byId, options } from '../../dom';
import { toggleHeight } from '../../motion';
import { mountSteppers, numberField } from '../../stepper';
import { stepCard } from '../cards/cards';
import * as customCovers from '../custom-covers/custom-covers';
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
      <div><label for="temp">${f.temp}</label>${numberField(m, 'temp', f.temp, u.celsius, 'value="20"')}</div>
      <div><label for="rh">${f.rh}</label>${numberField(m, 'rh', f.rh, u.percent, 'value="50"')}</div>${weatherHours === null ? '' : `\n      ${weatherFill.markup(m, weatherHours)}`}
      <div class="full"><label for="air">${f.airflow}</label>
        <select id="air">
          ${options(AIRFLOWS, m.options.airflow, 'light')}
        </select></div>
      <div class="full">
        <label class="check"><input type="checkbox" id="night" role="switch"> ${f.night}</label>
      </div>
      <div class="night"><label for="ntemp">${f.nightTemp}</label>${numberField(m, 'ntemp', f.nightTemp, u.celsius, 'value="15"')}</div>
      <div class="night"><label for="nrh">${f.nightRh}</label>${numberField(m, 'nrh', f.nightRh, u.percent, 'value="60"')}</div>
      <div><label for="dtemp">${f.dampTemp}</label>${numberField(m, 'dtemp', f.dampTemp, u.celsius, 'value="15"')}</div>
      <div><label for="drh">${f.dampRh}</label>${numberField(m, 'drh', f.dampRh, u.percent, 'value="88"')}</div>
    </div>
    ${customCovers.markup(m)}`,
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
  const body = root.querySelector('#body-2')!;
  body.addEventListener('input', () => ctx.compute());
  mountSteppers(body, ctx.view.m);
  weatherFill.mount(root, ctx);
}
