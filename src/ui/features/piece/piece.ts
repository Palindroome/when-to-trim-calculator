// Section 1 "Praca": name, mass, shape, walls, clay, bat, wetness and the stage to reach.
import { BATS, CLAYS, SHAPES, STAGES, WETNESS } from '../../../domain/types';
import type { Messages } from '../../../i18n';
import type { AppContext } from '../../context';
import { options } from '../../dom';
import { numberMessageMarkup } from '../../form';
import { stepCard } from '../cards/cards';

export function markup(m: Messages): string {
  const f = m.fields;
  const u = m.units;
  const o = m.options;
  return stepCard(
    1,
    'vessel',
    m.sections.piece,
    `<div class="grid">
      <div class="full"><label for="name">${f.name}</label><input id="name" placeholder="${f.namePlaceholder}"></div>
      <div><label for="mass">${f.mass}</label><div class="unit"><input id="mass" type="text" inputmode="decimal" autocomplete="off" value="500"><span>${u.grams}</span></div>${numberMessageMarkup('mass')}</div>
      <div><label for="shape">${f.shape}</label>
        <select id="shape">
          ${options(SHAPES, o.shape)}
        </select></div>
      <div><label for="wall">${f.wall}</label><div class="unit"><input id="wall" type="text" inputmode="decimal" autocomplete="off" value="6"><span>${u.millimetres}</span></div>${numberMessageMarkup('wall')}</div>
      <div><label for="base">${f.base}</label><div class="unit"><input id="base" type="text" inputmode="decimal" autocomplete="off" value="9"><span>${u.millimetres}</span></div>${numberMessageMarkup('base')}</div>
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
    </div>`,
  );
}

export function mount(root: HTMLElement, ctx: AppContext): void {
  root.querySelector('#body-1')!.addEventListener('input', () => ctx.compute());
}
