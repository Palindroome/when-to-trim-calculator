// Page structure: the sections in page order, each rendered by its feature module.
import type { CoverDefinition } from '../domain/covers';
import type { Messages } from '../i18n';
import { stepCard } from './features/cards/cards';
import * as conditions from './features/conditions/conditions';
import * as coverFilter from './features/covers/covers';
import * as datetime from './features/datetime/datetime';
import * as header from './features/header/header';
import * as piece from './features/piece/piece';
import * as pieces from './features/pieces/pieces';
import * as result from './features/result/result';
import * as weight from './features/weight/weight';
import * as welcome from './features/welcome/welcome';
import * as wizard from './features/wizard/wizard';

/** How the calculator works, folded by default. */
function explainer(m: Messages): string {
  return `<section class="card">
    <details>
      <summary>${m.explainer.summary}</summary>
      <ul>
        ${m.explainer.itemsHtml.map((li) => `<li>${li}</li>`).join('\n        ')}
      </ul>
    </details>
  </section>`;
}

/** Static page structure (the result, weight check and piece list are filled in by their features). */
export function renderShell(
  m: Messages,
  locales: readonly string[],
  theme: header.ThemeChoice,
  covers: readonly CoverDefinition[],
): string {
  return [
    header.markup(m, locales, theme),
    welcome.markup(m),
    `<p class="lead">${m.lead}</p>`,
    wizard.barMarkup(m),
    piece.markup(m),
    conditions.markup(m),
    stepCard(
      3,
      'clock',
      m.sections.schedule,
      `${datetime.markup(m)}\n    ${coverFilter.markup(m, covers)}`,
    ),
    result.markup,
    wizard.navMarkup(m),
    weight.markup(m, covers),
    pieces.markup(m),
    explainer(m),
  ].join('\n  ');
}
