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
  /** shows the welcome screen and moves focus to its heading */
  show(): void;
  readonly open: boolean;
}

export interface WelcomeActions {
  /** number of saved pieces, for "My pieces (N)" */
  pieceCount(): number;
  /** "New piece", after the welcome screen has closed */
  onNew(): void;
  /** "My pieces", after the welcome screen has closed */
  onPieces(): void;
}

export function createWelcome(root: HTMLElement, actions: WelcomeActions): Welcome {
  let open = false;
  let m: Messages;

  function apply(): void {
    root.classList.toggle('welcome', open);
    // hidden sections must not be reachable by keyboard or assistive technology either
    for (const el of root.children) {
      if (!el.matches('.masthead, .welcome-screen')) el.toggleAttribute('inert', open);
    }
    const n = actions.pieceCount();
    const pieces = byId('welcome-pieces');
    pieces.hidden = n === 0;
    pieces.textContent = m.welcome.pieces(n);
  }

  function close(then: () => void): void {
    open = false;
    apply();
    then();
  }

  return {
    get open() {
      return open;
    },
    mount(messages) {
      m = messages;
      byId('welcome-new').onclick = () => close(actions.onNew);
      byId('welcome-pieces').onclick = () => close(actions.onPieces);
      apply();
    },
    show() {
      open = true;
      apply();
      const h = byId('welcome-title');
      h.tabIndex = -1;
      h.focus();
    },
  };
}
