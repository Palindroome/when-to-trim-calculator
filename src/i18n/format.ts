import type { Messages } from './pl';

export interface Formatter {
  /** Rounded duration such as "45 min", "5 h", "2 d 3 h"; non-finite → beyond the horizon. */
  duration(hours: number): string;
  /** Short local date-time such as "śr 4.03 10:00" or "Wed 4 Mar 10:00". */
  dateTime(ms: number): string;
  /** Short local date such as "śr 4.03" or "Wed 4 Mar". */
  date(ms: number): string;
  /** Fixed decimals with the locale's separator. */
  decimal(x: number, digits: number): string;
}

const pad = (n: number): string => String(n).padStart(2, '0');

export function createFormatter(m: Messages, horizonDays: number): Formatter {
  const f = m.format;
  return {
    duration(h) {
      if (!Number.isFinite(h)) return f.beyondHorizon(horizonDays);
      if (h < 1) return f.minutes(Math.max(1, Math.round(h * 60)));
      const d = Math.floor(h / 24);
      const r = Math.round(h - d * 24);
      if (d === 0) return f.hours(r);
      if (r === 24) return f.days(d + 1);
      return r ? f.daysHours(d, r) : f.days(d);
    },
    dateTime(ms) {
      const d = new Date(ms);
      return f.dateTime(
        String(f.weekdaysShort[d.getDay()]),
        d.getDate(),
        pad(d.getMonth() + 1),
        pad(d.getHours()),
        pad(d.getMinutes()),
        String(f.monthsShort[d.getMonth()]),
      );
    },
    date(ms) {
      const d = new Date(ms);
      return f.date(String(f.weekdaysShort[d.getDay()]), d.getDate(), pad(d.getMonth() + 1), String(f.monthsShort[d.getMonth()]));
    },
    decimal(x, digits) {
      return x.toFixed(digits).replace('.', f.decimalSeparator);
    },
  };
}
