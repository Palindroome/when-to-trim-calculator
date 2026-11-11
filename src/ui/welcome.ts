// Welcome screen: on the first visit and after a long pause, everything but the masthead is replaced by an introduction.
import type { Messages } from '../i18n';
import { byId } from './dom';

/** True when there is no recorded activity, or it is at least `idleMs` old (or that far in the future: a broken clock). */
export function shouldWelcome(lastActiveMs: number | null, nowMs: number, idleMs: number): boolean {
  return lastActiveMs === null || Math.abs(nowMs - lastActiveMs) >= idleMs;
}

export interface Welcome {
  /** binds the controls of a freshly rendered shell (first render and after a language switch) */
  mount(m: Messages): void;
  /** shows the welcome screen, with the pieces list collapsed, and moves focus to its heading */
  show(): void;
  readonly open: boolean;
}

export interface WelcomeActions {
  /** number of saved pieces, for "My pieces (N)" */
  pieceCount(): number;
  /** rows of the "My pieces" list, each with a `[data-details]` button carrying the piece id */
  pieceRows(): string;
  /** "New piece", after the welcome screen has closed */
  onNew(): void;
  /** "Details" of a piece in the list, after the welcome screen has closed */
  onDetails(id: string): void;
}

export function createWelcome(root: HTMLElement, actions: WelcomeActions): Welcome {
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
    const n = actions.pieceCount();
    const listed = expanded && n > 0;
    const pieces = byId('welcome-pieces');
    pieces.hidden = n === 0;
    pieces.textContent = m.welcome.pieces(n);
    pieces.setAttribute('aria-expanded', String(listed));
    const list = byId('welcome-list');
    list.hidden = !listed;
    list.innerHTML = listed ? actions.pieceRows() : '';
    list.querySelectorAll<HTMLElement>('[data-details]').forEach((b) => {
      b.onclick = () => close(() => actions.onDetails(b.dataset.details ?? ''));
    });
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

  return {
    get open() {
      return open;
    },
    mount(messages) {
      m = messages;
      byId('welcome-new').onclick = () => close(actions.onNew);
      byId('welcome-pieces').onclick = () => {
        expanded = !expanded;
        apply();
      };
      byId('welcome-back').onclick = show;
      apply();
    },
    show,
  };
}
