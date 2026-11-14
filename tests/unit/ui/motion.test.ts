import { readdirSync, readFileSync } from 'node:fs';
import { join, relative, sep } from 'node:path';
import { describe, expect, it, vi } from 'vitest';

// a fake media query the test can flip, standing in for the browser's prefers-reduced-motion
let reduce = false;
vi.stubGlobal('window', {
  matchMedia: () => ({
    get matches() {
      return reduce;
    },
  }),
});
const motion = await import('../../../src/ui/motion');

describe('prefersReducedMotion', () => {
  it('follows the system setting while the page is open', () => {
    reduce = false;
    expect(motion.prefersReducedMotion()).toBe(false);
    expect(motion.scrollBehavior()).toBe('smooth');
    reduce = true;
    expect(motion.prefersReducedMotion()).toBe(true);
    expect(motion.scrollBehavior()).toBe('auto');
  });

  it('makes exit() resolve at once without touching the element', async () => {
    reduce = true;
    const el = {} as HTMLElement;
    await expect(motion.exit(el)).resolves.toBeUndefined();
    expect(el).toEqual({});
  });

  it('leaves the test hook idle', async () => {
    await expect(window.__motionIdle!()).resolves.toBeUndefined();
  });
});

describe('SPRING', () => {
  it('rises from 0 to 1 without overshoot and settles within about 400 ms', () => {
    expect(motion.springAt(0)).toBe(0);
    let last = 0;
    for (let t = 0.01; t < 1; t += 0.01) {
      const x = motion.springAt(t);
      expect(x).toBeGreaterThanOrEqual(last);
      expect(x).toBeLessThanOrEqual(1);
      last = x;
    }
    expect(motion.SPRING_MS).toBeGreaterThan(250);
    expect(motion.SPRING_MS).toBeLessThanOrEqual(400);
    expect(motion.springAt(motion.SPRING_MS / 1000)).toBeGreaterThan(0.99);
  });
});

describe('motion boundary', () => {
  const src = join(__dirname, '../../../src');
  const files = (dir: string): string[] =>
    readdirSync(dir, { withFileTypes: true }).flatMap((e) =>
      e.isDirectory() ? files(join(dir, e.name)) : [join(dir, e.name)],
    );

  it('keeps animation code in src/ui/motion.ts only', () => {
    const offenders = files(src)
      .filter((f) => f.endsWith('.ts') && relative(src, f).split(sep).join('/') !== 'ui/motion.ts')
      .filter((f) =>
        /from 'motion|\.animate\(|requestAnimationFrame|startViewTransition/.test(
          readFileSync(f, 'utf8'),
        ),
      );
    expect(offenders).toEqual([]);
  });
});
