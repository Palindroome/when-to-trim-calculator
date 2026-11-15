import type { CoverId } from '../domain/covers';

/** The form as `captureForm` (ui/form-state.ts) returns it. */
export interface SessionForm {
  fields: { id: string; value: string; checked: boolean }[];
  dates: { quick: string | undefined; thrownPreset: string | undefined };
  allowed: CoverId[];
}

/**
 * The page as the user left it, restored by a reload within the idle window. Kept per tab under its
 * own key so `kiedy-trymowac-v1` stays unchanged.
 */
export interface SessionSnapshot {
  screen: 'welcome' | 'calculator';
  /** whether the welcome screen's "My pieces" list is expanded */
  piecesListed: boolean;
  form: SessionForm;
  /** current wizard step (0-based); null when the wizard is closed */
  wizardStep: number | null;
  scrollY: number;
}

export interface SessionStore {
  /** null: nothing saved, or not a valid snapshot */
  load(): SessionSnapshot | null;
  save(snapshot: SessionSnapshot): void;
}

export const SESSION_KEY = 'kiedy-trymowac-session';

const isObject = (v: unknown): v is Record<string, unknown> =>
  typeof v === 'object' && v !== null && !Array.isArray(v);
const isOptionalString = (v: unknown): v is string | undefined =>
  v === undefined || typeof v === 'string';
const isCount = (v: unknown): v is number => typeof v === 'number' && Number.isInteger(v) && v >= 0;

function isField(v: unknown): v is SessionForm['fields'][number] {
  return (
    isObject(v) &&
    typeof v.id === 'string' &&
    typeof v.value === 'string' &&
    typeof v.checked === 'boolean'
  );
}

function parse(v: unknown): SessionSnapshot | null {
  if (!isObject(v) || !isObject(v.form) || !isObject(v.form.dates)) return null;
  const { form } = v;
  const dates = form.dates as Record<string, unknown>;
  const valid =
    (v.screen === 'welcome' || v.screen === 'calculator') &&
    typeof v.piecesListed === 'boolean' &&
    (v.wizardStep === null || isCount(v.wizardStep)) &&
    typeof v.scrollY === 'number' &&
    Number.isFinite(v.scrollY) &&
    Array.isArray(form.fields) &&
    form.fields.every(isField) &&
    isOptionalString(dates.quick) &&
    isOptionalString(dates.thrownPreset) &&
    Array.isArray(form.allowed) &&
    form.allowed.every((c) => typeof c === 'string');
  if (!valid) return null;
  return {
    screen: v.screen as SessionSnapshot['screen'],
    piecesListed: v.piecesListed as boolean,
    form: {
      fields: form.fields as SessionForm['fields'],
      dates: {
        quick: dates.quick as string | undefined,
        thrownPreset: dates.thrownPreset as string | undefined,
      },
      allowed: form.allowed as CoverId[],
    },
    wizardStep: v.wizardStep as number | null,
    scrollY: v.scrollY as number,
  };
}

/** sessionStorage-backed JSON (per tab); invalid values read as null and storage errors (quota, privacy mode) are swallowed. */
export class SessionStorageSessionStore implements SessionStore {
  constructor(
    private readonly storage: Pick<Storage, 'getItem' | 'setItem'> = sessionStorage,
    private readonly key: string = SESSION_KEY,
  ) {}

  load(): SessionSnapshot | null {
    try {
      const v = this.storage.getItem(this.key);
      return v === null ? null : parse(JSON.parse(v));
    } catch {
      return null;
    }
  }

  save(snapshot: SessionSnapshot): void {
    try {
      this.storage.setItem(this.key, JSON.stringify(snapshot));
    } catch {
      // ignore quota / privacy-mode errors
    }
  }
}
