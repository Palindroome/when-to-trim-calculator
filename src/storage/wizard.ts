/** How the first-run wizard ended. Kept under its own key so `kiedy-trymowac-v1` stays unchanged. */
export type WizardOutcome = 'done' | 'skipped';

export interface WizardStore {
  /** null: the wizard has never been finished or skipped */
  load(): WizardOutcome | null;
  save(outcome: WizardOutcome): void;
}

export const WIZARD_KEY = 'kiedy-trymowac-wizard';

/** localStorage-backed; unknown values read as null and storage errors (quota, privacy mode) are swallowed. */
export class LocalStorageWizardStore implements WizardStore {
  constructor(
    private readonly storage: Pick<Storage, 'getItem' | 'setItem'> = localStorage,
    private readonly key: string = WIZARD_KEY,
  ) {}

  load(): WizardOutcome | null {
    try {
      const v = this.storage.getItem(this.key);
      return v === 'done' || v === 'skipped' ? v : null;
    } catch {
      return null;
    }
  }

  save(outcome: WizardOutcome): void {
    try {
      this.storage.setItem(this.key, outcome);
    } catch {
      // ignore quota / privacy-mode errors
    }
  }
}
