/** Time of the last interaction, for the welcome screen. Kept under its own key so `kiedy-trymowac-v1` stays unchanged. */
export interface ActivityStore {
  /** epoch ms of the last interaction; null: none recorded */
  load(): number | null;
  save(ms: number): void;
}

export const ACTIVITY_KEY = 'kiedy-trymowac-last-active';

/** localStorage-backed, epoch ms as a string; invalid values read as null and storage errors (quota, privacy mode) are swallowed. */
export class LocalStorageActivityStore implements ActivityStore {
  constructor(
    private readonly storage: Pick<Storage, 'getItem' | 'setItem'> = localStorage,
    private readonly key: string = ACTIVITY_KEY,
  ) {}

  load(): number | null {
    try {
      const v = this.storage.getItem(this.key);
      if (v === null || !/^\d+$/.test(v)) return null;
      return Number(v);
    } catch {
      return null;
    }
  }

  save(ms: number): void {
    try {
      this.storage.setItem(this.key, String(Math.round(ms)));
    } catch {
      // ignore quota / privacy-mode errors
    }
  }
}
