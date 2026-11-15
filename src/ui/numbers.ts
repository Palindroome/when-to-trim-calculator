// Changing numbers in the result: their markup, their per-frame wording and when they snap instead of counting.
import type { Formatter } from '../i18n';

/** duration: hours; dateTime: epoch ms; decimal: `digits` decimals; int: rounded (grams). */
export type NumKind = 'duration' | 'dateTime' | 'decimal' | 'int';

export interface NumValue {
  kind: NumKind;
  value: number;
  /** decimals, for `decimal` */
  digits?: number;
  /** text after the number, e.g. "+" on a bar that runs past the chart */
  suffix?: string;
}

/** The number as the formatter writes it; every animation frame uses the same wording. */
export function formatNum(fmt: Formatter, n: NumValue): string {
  let text: string;
  if (n.kind === 'duration') text = fmt.duration(n.value);
  else if (n.kind === 'dateTime') text = fmt.dateTime(n.value);
  else if (n.kind === 'decimal') text = fmt.decimal(n.value, n.digits ?? 0);
  else text = String(Math.round(n.value));
  return text + (n.suffix ?? '');
}

/**
 * A number wrapped for counting: the text is exactly `formatNum`, the raw value and kind ride along in
 * data attributes. The span is inline and adds no whitespace, so the visible text is unchanged.
 */
export function num(fmt: Formatter, key: string, n: NumValue): string {
  const digits = n.digits === undefined ? '' : ` data-num-digits="${n.digits}"`;
  const suffix = n.suffix ? ` data-num-suffix="${n.suffix}"` : '';
  return `<span class="num" data-num-key="${key}" data-num-kind="${n.kind}" data-num-value="${n.value}"${digits}${suffix}>${formatNum(fmt, n)}</span>`;
}

/**
 * Whether a number jumps straight to its new text instead of counting from `prev` (the value shown now):
 * another kind or precision, a non-finite end, the suffix appearing or going, or nothing visible to change.
 */
export function shouldSnap(fmt: Formatter, prev: NumValue, next: NumValue): boolean {
  return (
    prev.kind !== next.kind ||
    prev.digits !== next.digits ||
    (prev.suffix ?? '') !== (next.suffix ?? '') ||
    !Number.isFinite(prev.value) ||
    !Number.isFinite(next.value) ||
    formatNum(fmt, prev) === formatNum(fmt, next)
  );
}
