/**
 * User-defined covers, stored as `{"covers": StoredCover[]}` under their own key so that
 * `kiedy-trymowac-v1` (the saved pieces) is never written by this store.
 */
export interface StoredCover {
  id: `custom:${string}`;
  /** the name the user typed, trimmed */
  name: string;
  /** fraction of open-air drying speed, (0, 1] */
  factor: number;
  airflow: 'damped' | 'none';
  /** the speed preset picked in the form (`custom`: own value), so editing can reselect it */
  preset: string;
  /** icon id picked in the form; the UI shows a neutral icon for an unknown one */
  icon: string;
  /** epoch ms when added */
  created: number;
}

export interface CoverRepository {
  load(): StoredCover[];
  save(covers: readonly StoredCover[]): void;
}

export const COVERS_KEY = 'kiedy-trymowac-covers';

const ID = /^custom:[\w-]+$/;

/** A stored entry as a cover, or null when it cannot be used. */
function readCover(x: unknown): StoredCover | null {
  if (typeof x !== 'object' || x === null) return null;
  const c = x as Record<string, unknown>;
  if (typeof c.id !== 'string' || !ID.test(c.id) || typeof c.name !== 'string') return null;
  if (typeof c.factor !== 'number' || !(c.factor > 0 && c.factor <= 1)) return null;
  if (c.airflow !== 'damped' && c.airflow !== 'none') return null;
  return {
    id: c.id as StoredCover['id'],
    name: c.name,
    factor: c.factor,
    airflow: c.airflow,
    preset: typeof c.preset === 'string' ? c.preset : 'custom',
    icon: typeof c.icon === 'string' ? c.icon : '',
    created: typeof c.created === 'number' ? c.created : 0,
  };
}

/** localStorage-backed; unusable entries are skipped, duplicate ids keep the first, storage errors are swallowed. */
export class LocalStorageCoverRepository implements CoverRepository {
  constructor(
    private readonly storage: Pick<Storage, 'getItem' | 'setItem'> = localStorage,
    private readonly key: string = COVERS_KEY,
  ) {}

  load(): StoredCover[] {
    let list: unknown;
    try {
      list = (JSON.parse(this.storage.getItem(this.key) ?? 'null') as { covers?: unknown } | null)
        ?.covers;
    } catch {
      return [];
    }
    if (!Array.isArray(list)) return [];
    const out: StoredCover[] = [];
    for (const x of list) {
      const c = readCover(x);
      if (c && !out.some((o) => o.id === c.id)) out.push(c);
    }
    return out;
  }

  save(covers: readonly StoredCover[]): void {
    try {
      this.storage.setItem(this.key, JSON.stringify({ covers }));
    } catch {
      // ignore quota / privacy-mode errors
    }
  }
}
