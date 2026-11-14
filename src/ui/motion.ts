// All UI motion in one module, so the rest of the UI only calls these helpers. Element animations use the
// Web Animations API with the spring below as a CSS linear() easing; counting numbers step the same spring
// with requestAnimationFrame. Every helper does nothing (or finishes at once) under prefers-reduced-motion,
// and every animation plays on top of the final DOM, which it leaves unchanged.
import type { Formatter } from '../i18n';
import { formatNum, type NumKind, type NumValue, shouldSnap } from './numbers';

/** The one spring of the UI: critically damped (no overshoot), settles in about 370 ms. */
export const SPRING = { stiffness: 400, damping: 40, mass: 1 } as const;
/** --dur-fast / --dur-base in tokens.css */
const DUR = { fast: 120, base: 200 } as const;
/** --ease-out in tokens.css */
const EASE_OUT = 'cubic-bezier(.2,.8,.2,1)';
/** how far a fading-in element rises, px */
const RISE = 5;
/** the spring counts as settled within this fraction of the distance */
const REST = 0.005;

/** Spring position from 0 to 1 at `t` seconds, starting at rest. */
export function springAt(t: number): number {
  const { stiffness: k, damping: c, mass: m } = SPRING;
  const w = Math.sqrt(k / m);
  const z = c / (2 * Math.sqrt(k * m));
  if (z < 1) {
    const wd = w * Math.sqrt(1 - z * z);
    return 1 - Math.exp(-z * w * t) * (Math.cos(wd * t) + ((z * w) / wd) * Math.sin(wd * t));
  }
  // critically damped (the overdamped case is close enough to it for these settings)
  return 1 - Math.exp(-w * t) * (1 + w * t);
}

/** Milliseconds until the spring stays within REST of its target. */
export const SPRING_MS = (() => {
  let settled = 0;
  for (let t = 0; t < 2; t += 0.005) if (Math.abs(1 - springAt(t)) > REST) settled = t + 0.005;
  return Math.round(settled * 1000);
})();

let springEasing: string | undefined;
/** WAAPI timing of the spring: linear() sampled from springAt, or --ease-out where linear() is missing. */
function springTiming(): KeyframeAnimationOptions {
  if (springEasing === undefined) {
    const points = Array.from(
      { length: 24 },
      (_, i) => +springAt((i / 24) * (SPRING_MS / 1000)).toFixed(4),
    );
    springEasing = CSS.supports('transition-timing-function', 'linear(0, 1)')
      ? `linear(${[...points, 1].join(',')})`
      : EASE_OUT;
  }
  return { duration: SPRING_MS, easing: springEasing };
}

let reduceQuery: MediaQueryList | undefined;
/** Live: follows changes of the system setting without a reload. */
export function prefersReducedMotion(): boolean {
  reduceQuery ??= window.matchMedia('(prefers-reduced-motion: reduce)');
  return reduceQuery.matches;
}

export const scrollBehavior = (): ScrollBehavior => (prefersReducedMotion() ? 'auto' : 'smooth');

// ---------- running animations, for the test hook ----------

const running = new Set<Promise<void>>();
function track(p: Promise<unknown>): void {
  const settled = p.then(
    () => {},
    () => {},
  );
  running.add(settled);
  void settled.then(() => running.delete(settled));
}

/** Resolves once every animation started here has finished or been interrupted. */
export async function motionIdle(): Promise<void> {
  while (running.size) await Promise.all(running);
}

declare global {
  interface Window {
    /** test hook (e2e): see motionIdle */
    __motionIdle?: () => Promise<void>;
  }
}
if (typeof window !== 'undefined') window.__motionIdle = motionIdle;

function play(el: Element, keyframes: Keyframe[], timing: KeyframeAnimationOptions): Animation {
  const a = el.animate(keyframes, timing);
  track(a.finished);
  return a;
}

// ---------- re-rendered content (FLIP) ----------

interface Box {
  /** left edge and width relative to the parent, as currently seen (mid-animation included) */
  x: number;
  w: number;
  bg: string;
}
export interface Snapshot {
  boxes: Map<string, Box>;
  texts: Map<string, string>;
}

function box(el: HTMLElement): Box {
  const r = el.getBoundingClientRect();
  const p = el.parentElement!.getBoundingClientRect();
  return { x: r.left - p.left, w: r.width, bg: getComputedStyle(el).backgroundColor };
}

/** The wording of an element without its counting numbers. */
function wording(el: Element): string {
  let s = '';
  for (const n of el.childNodes) {
    if (!(n instanceof Element)) s += n.textContent;
    else if (n.matches('.num, .vh')) s += '#';
    else s += wording(n);
  }
  return s;
}

/**
 * Records `[data-anim-key]` boxes and `[data-anim-text]` wording before `root` is re-rendered, then
 * interrupts whatever still runs inside it: the next render starts from what is on screen now.
 */
export function captureRects(root: HTMLElement): Snapshot {
  const snap: Snapshot = { boxes: new Map(), texts: new Map() };
  if (!prefersReducedMotion()) {
    for (const el of root.querySelectorAll<HTMLElement>('[data-anim-key]'))
      snap.boxes.set(el.dataset.animKey!, box(el));
    for (const el of root.querySelectorAll<HTMLElement>('[data-anim-text]'))
      snap.texts.set(el.dataset.animText!, wording(el));
  }
  for (const a of root.getAnimations({ subtree: true })) a.cancel();
  return snap;
}

/**
 * After the re-render: keyed boxes glide (spring) from their previous horizontal position and width
 * and cross-fade their colour; keyed text whose wording changed fades in. Nothing on the first render.
 */
export function playFrom(snap: Snapshot, root: HTMLElement): void {
  if (prefersReducedMotion()) return;
  for (const el of root.querySelectorAll<HTMLElement>('[data-anim-key]')) {
    const prev = snap.boxes.get(el.dataset.animKey!);
    if (!prev) continue;
    const now = box(el);
    if (
      now.w > 0 &&
      prev.w > 0 &&
      (Math.abs(prev.x - now.x) > 0.5 || Math.abs(prev.w - now.w) > 0.5)
    ) {
      const from = `translateX(${prev.x - now.x}px) scaleX(${prev.w / now.w})`;
      play(
        el,
        [
          { transform: from, transformOrigin: '0 50%' },
          { transform: 'none', transformOrigin: '0 50%' },
        ],
        springTiming(),
      );
    }
    if (prev.bg !== now.bg)
      play(el, [{ backgroundColor: prev.bg }, { backgroundColor: now.bg }], {
        duration: DUR.base,
        easing: EASE_OUT,
      });
  }
  if (!snap.texts.size) return;
  for (const el of root.querySelectorAll<HTMLElement>('[data-anim-text]')) {
    if (snap.texts.get(el.dataset.animText!) !== wording(el)) reveal(el);
  }
}

// ---------- single elements ----------

/** Fades the element in with a small rise: changed text, a changed state message. */
export function reveal(el: HTMLElement): void {
  if (prefersReducedMotion()) return;
  play(
    el,
    [
      { opacity: 0, transform: `translateY(${RISE}px)` },
      { opacity: 1, transform: 'none' },
    ],
    { duration: DUR.base, easing: EASE_OUT },
  );
}

/** A new element arrives: fade, rise and a slight scale (spring). */
export function enter(el: HTMLElement): void {
  if (prefersReducedMotion()) return;
  play(
    el,
    [
      { opacity: 0, transform: `translateY(${RISE}px) scale(.98)` },
      { opacity: 1, transform: 'none' },
    ],
    springTiming(),
  );
}

/** An element leaves: fast fade and collapse; it stays collapsed until the caller removes it. */
export function exit(el: HTMLElement): Promise<void> {
  if (prefersReducedMotion()) return Promise.resolve();
  const cs = getComputedStyle(el);
  el.style.overflow = 'hidden';
  const a = play(
    el,
    [
      {
        opacity: 1,
        height: `${el.offsetHeight}px`,
        paddingTop: cs.paddingTop,
        paddingBottom: cs.paddingBottom,
      },
      { opacity: 0, height: '0px', paddingTop: '0px', paddingBottom: '0px' },
    ],
    { duration: DUR.fast, easing: EASE_OUT, fill: 'forwards' },
  );
  return a.finished.then(
    () => {},
    () => {},
  );
}

/**
 * Shows or hides an element (the `.hide` class) with a height and opacity transition: expanding with the
 * spring, collapsing fast. A toggle mid-way starts from the current height.
 */
export function toggleHeight(el: HTMLElement, show: boolean): void {
  const current = el.getAnimations();
  const from = current.length
    ? { h: el.getBoundingClientRect().height, o: Number(getComputedStyle(el).opacity) }
    : null;
  for (const a of current) a.cancel();
  el.classList.remove('hide');
  if (prefersReducedMotion()) {
    el.style.overflow = '';
    el.classList.toggle('hide', !show);
    return;
  }
  const full = el.offsetHeight;
  const start = from ?? (show ? { h: 0, o: 0 } : { h: full, o: 1 });
  el.style.overflow = 'hidden';
  const a = play(
    el,
    [
      { height: `${start.h}px`, opacity: start.o },
      { height: show ? `${full}px` : '0px', opacity: show ? 1 : 0 },
    ],
    show ? springTiming() : { duration: DUR.fast, easing: EASE_OUT },
  );
  a.finished.then(
    () => {
      el.style.overflow = '';
      if (!show) el.classList.add('hide');
    },
    () => {},
  );
}

const slides = new WeakMap<HTMLElement, Animation>();

/**
 * Sliding active indicator for a group of options: an accent box (`.slide-ind`) glides from `from`
 * (the previous option's box, or the indicator's current box when it is still moving) to `to`.
 * The group carries `.sliding` meanwhile, so the chosen option's own accent waits for it.
 */
export function slideIndicator(
  group: HTMLElement,
  from: DOMRect | undefined,
  to: HTMLElement | null,
): void {
  const moving = slides.get(group);
  if (moving) {
    from = (moving.effect as KeyframeEffect).target!.getBoundingClientRect();
    moving.cancel();
  }
  if (prefersReducedMotion() || !from || !to) return;
  const g = group.getBoundingClientRect();
  const t = to.getBoundingClientRect();
  if (
    Math.abs(from.left - t.left) < 0.5 &&
    Math.abs(from.top - t.top) < 0.5 &&
    Math.abs(from.width - t.width) < 0.5
  )
    return;
  const ind = document.createElement('span');
  ind.className = 'slide-ind';
  ind.setAttribute('aria-hidden', 'true');
  Object.assign(ind.style, {
    left: `${t.left - g.left}px`,
    top: `${t.top - g.top}px`,
    width: `${t.width}px`,
    height: `${t.height}px`,
  });
  group.append(ind);
  group.classList.add('sliding');
  const start = `translate(${from.left - t.left}px, ${from.top - t.top}px) scale(${from.width / t.width}, ${from.height / t.height})`;
  const a = play(ind, [{ transform: start }, { transform: 'none' }], springTiming());
  slides.set(group, a);
  const done = (): void => {
    ind.remove();
    if (slides.get(group) !== a) return;
    slides.delete(group);
    group.classList.remove('sliding');
  };
  a.finished.then(done, done);
}

/** Runs a page-wide DOM update as a cross-fade (View Transitions API) where available. */
export function viewTransition(update: () => void): void {
  if (prefersReducedMotion() || !('startViewTransition' in document)) {
    update();
    return;
  }
  track(document.startViewTransition(update).finished);
}

// ---------- counting numbers ----------

interface Counter {
  /** the value on screen now, with the kind and wording of its latest target */
  shown: NumValue;
  /** ends a running count at once (the span gets its exact text back) */
  stop?: () => void;
}
const counters = new Map<string, Counter>();

function readNum(el: HTMLElement): NumValue {
  const d = el.dataset;
  const n: NumValue = { kind: d.numKind as NumKind, value: Number(d.numValue) };
  if (d.numDigits !== undefined) n.digits = Number(d.numDigits);
  if (d.numSuffix) n.suffix = d.numSuffix;
  return n;
}

/**
 * After a re-render: every `[data-num-key]` counts from the value shown before (mid-count included) to its
 * new value, writing each frame with the same formatter, and ends on exactly the rendered text. While it
 * counts, the span is aria-hidden and a visually hidden sibling holds the final text.
 */
export function animateNumbers(root: HTMLElement, fmt: Formatter): void {
  const seen = new Set<string>();
  for (const el of root.querySelectorAll<HTMLElement>('[data-num-key]')) {
    const key = el.dataset.numKey!;
    seen.add(key);
    const next = readNum(el);
    const prev = counters.get(key);
    prev?.stop?.();
    if (!prev || prefersReducedMotion() || shouldSnap(fmt, prev.shown, next))
      counters.set(key, { shown: next });
    else count(el, key, prev.shown.value, next, fmt);
  }
  for (const [key, c] of counters) {
    if (seen.has(key)) continue;
    c.stop?.();
    counters.delete(key);
  }
}

function count(el: HTMLElement, key: string, from: number, to: NumValue, fmt: Formatter): void {
  const exact = el.textContent ?? '';
  const sr = document.createElement('span');
  sr.className = 'vh';
  sr.textContent = exact;
  el.after(sr);
  el.setAttribute('aria-hidden', 'true');
  const c: Counter = { shown: { ...to, value: from } };
  counters.set(key, c);
  const show = (v: number): void => {
    c.shown = { ...to, value: v };
    el.textContent = formatNum(fmt, c.shown);
  };
  // the same task as the re-render, so the new value never flashes before counting
  show(from);
  let resolve = (): void => {};
  track(new Promise<void>((r) => (resolve = r)));
  let frame = 0;
  const settle = (): void => {
    cancelAnimationFrame(frame);
    el.textContent = exact;
    el.removeAttribute('aria-hidden');
    sr.remove();
    c.stop = undefined;
    resolve();
  };
  c.stop = settle;
  const t0 = performance.now();
  const step = (now: number): void => {
    const t = now - t0;
    if (t >= SPRING_MS) {
      c.shown = to;
      settle();
      return;
    }
    show(from + (to.value - from) * springAt(t / 1000));
    frame = requestAnimationFrame(step);
  };
  frame = requestAnimationFrame(step);
}
