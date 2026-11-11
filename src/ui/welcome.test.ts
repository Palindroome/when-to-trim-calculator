import { describe, expect, it } from 'vitest';
import { shouldWelcome } from './welcome';

const HOUR = 60 * 60 * 1000;
const NOW = Date.parse('2026-03-04T09:00:00+01:00');

describe('shouldWelcome', () => {
  it('welcomes when no activity was ever recorded', () => {
    expect(shouldWelcome(null, NOW, HOUR)).toBe(true);
  });

  it('does not welcome just under the threshold', () => {
    expect(shouldWelcome(NOW - HOUR + 1, NOW, HOUR)).toBe(false);
    expect(shouldWelcome(NOW, NOW, HOUR)).toBe(false);
  });

  it('welcomes at and over the threshold', () => {
    expect(shouldWelcome(NOW - HOUR, NOW, HOUR)).toBe(true);
    expect(shouldWelcome(NOW - 61 * 60 * 1000, NOW, HOUR)).toBe(true);
  });

  it('tolerates a slightly future timestamp but welcomes on one more than the threshold ahead (broken clock)', () => {
    expect(shouldWelcome(NOW + 5 * 60 * 1000, NOW, HOUR)).toBe(false);
    expect(shouldWelcome(NOW + HOUR + 1, NOW, HOUR)).toBe(true);
  });
});
