// Welcome screen: on the first visit and after a long pause, everything but the masthead is replaced by an introduction.
import type { Messages } from '../../../i18n';
import type { ActivityStore } from '../../../storage/activity';
import type { StoredPiece } from '../../../storage/pieces';
import type { AppContext } from '../../context';
import { byId, closest, esc } from '../../dom';
import type { View } from '../../render';
import { pieceHighlights } from '../pieces/pieces';

/** Interactions are written to storage at most this often. */
const ACTIVITY_SAVE_MS = 60 * 1000;

export function markup(m: Messages): string {
  return `<div class="card welcome-screen" role="region" aria-labelledby="welcome-title">
    <h2 id="welcome-title">${m.welcome.title}</h2>
    ${m.welcome.intro.map((s) => `<p>${s}</p>`).join('\n    ')}
    <h3>${m.welcome.stepsTitle}</h3>
    <ol>
      ${m.welcome.steps.map((s) => `<li>${s}</li>`).join('\n      ')}
    </ol>
    <p class="muted">${m.welcome.privacy}</p>
    <div class="welcome-actions">
      <button type="button" class="main" id="welcome-new">${m.welcome.start}</button>
      <button type="button" class="ghost" id="welcome-pieces" aria-expanded="false" aria-controls="welcome-list"></button>
    </div>
    <ul class="welcome-list" id="welcome-list" hidden></ul>
  </div>`;
}

/** Rows of the welcome screen's "My pieces" list: the highlights of each piece and a link to its details. */
export function renderWelcomePieces(
  v: View,
  pieces: readonly StoredPiece[],
  nowMs: number,
): string {
  const { m } = v;
  return pieces
    .map((p) => {
      const h = pieceHighlights(v, p, nowMs);
      return `<li class="piece">
          ${h.top}
          <div class="meta">${h.times}</div>
          <button type="button" class="ghost" data-details="${esc(p.id)}" aria-label="${esc(m.welcome.detailsLabel(p.name))}">${m.welcome.details}</button>
        </li>`;
    })
    .join('');
}

/** True when there is no recorded activity, or it is at least `idleMs` old (or that far in the future: a broken clock). */
export function shouldWelcome(lastActiveMs: number | null, nowMs: number, idleMs: number): boolean {
  return lastActiveMs === null || Math.abs(nowMs - lastActiveMs) >= idleMs;
}

export interface Welcome {
  /** applies the state to a freshly rendered shell (first render and after a language switch) */
  mount(m: Messages): void;
  /** shows the welcome screen, with the pieces list collapsed, and moves focus to its heading */
  show(): void;
  readonly open: boolean;
}

export interface WelcomeActions {
  /** "New piece", after the welcome screen has closed */
  onNew(): void;
  /** "Details" of a piece in the list, after the welcome screen has closed */
  onDetails(id: string): void;
}

export function createWelcome(
  root: HTMLElement,
  ctx: AppContext,
  actions: WelcomeActions,
): Welcome {
  let open = false;
  /** whether the "My pieces" list is expanded */
  let expanded = false;
  let m: Messages;

  function apply(): void {
    root.classList.toggle('welcome', open);
    // hidden sections must not be reachable by keyboard or assistive technology either
    for (const el of root.children) {
      if (!el.matches('.masthead, .welcome-screen')) el.toggleAttribute('inert', open);
    }
    const n = ctx.pieces.length;
    const listed = expanded && n > 0;
    const pieces = byId('welcome-pieces');
    pieces.hidden = n === 0;
    pieces.textContent = m.welcome.pieces(n);
    pieces.setAttribute('aria-expanded', String(listed));
    const list = byId('welcome-list');
    list.hidden = !listed;
    list.innerHTML = listed ? renderWelcomePieces(ctx.view, ctx.pieces, ctx.now()) : '';
  }

  function close(then: () => void): void {
    open = false;
    apply();
    then();
  }

  function show(): void {
    open = true;
    expanded = false;
    apply();
    const h = byId('welcome-title');
    h.tabIndex = -1;
    h.focus();
  }

  // root outlives every render, so one listener serves every shell
  root.addEventListener('click', (e) => {
    const b = closest(e, 'button');
    if (!b) return;
    if (b.id === 'welcome-new') close(actions.onNew);
    else if (b.id === 'welcome-back') show();
    else if (b.id === 'welcome-pieces') {
      expanded = !expanded;
      apply();
    } else if (b.dataset.details !== undefined && b.closest('#welcome-list')) {
      close(() => actions.onDetails(b.dataset.details ?? ''));
    }
  });

  return {
    get open() {
      return open;
    },
    mount(messages) {
      m = messages;
      apply();
    },
    show,
  };
}

/**
 * Records interactions with the page and shows the welcome screen when the page comes back
 * (tab shown again, page restored from the history) after `idleMs` without one.
 */
export function trackActivity(
  root: HTMLElement,
  welcome: Welcome,
  activity: ActivityStore,
  now: () => number,
  idleMs: number,
): void {
  // kept in memory as well, so a page whose storage fails does not welcome on every return to the tab
  let lastActive = activity.load();
  let lastSaved: number | null = null;

  function recordActivity(): void {
    const t = now();
    lastActive = t;
    if (lastSaved !== null && t - lastSaved < ACTIVITY_SAVE_MS) return;
    lastSaved = t;
    activity.save(t);
  }

  function checkIdle(): void {
    if (!welcome.open && shouldWelcome(lastActive, now(), idleMs)) welcome.show();
  }

  for (const type of ['input', 'change', 'click']) root.addEventListener(type, recordActivity);
  document.addEventListener('visibilitychange', () => {
    if (document.visibilityState === 'visible') checkIdle();
  });
  window.addEventListener('pageshow', checkIdle);
  checkIdle();
}
