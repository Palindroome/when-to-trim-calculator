import type { CalibrationSample } from '../domain/calibration';
import type { Cover, FeedbackKind } from '../domain/types';

/**
 * Saved piece, exactly as stored by the original prototype under `kiedy-trymowac-v1`
 * (`{"pieces": StoredPiece[]}`). Field names are kept short for backward compatibility.
 */
export interface StoredPiece {
  id: string;
  name: string;
  /** epoch ms thrown */
  start: number;
  /** g (clamped) */
  mass: number;
  /** target loss, % */
  lossPct: number;
  /** covering plan; `h: null` = until done */
  plan: { w: Cover; h: number | null }[];
  /** plan sentence as displayed when saved (in the UI language of that moment) */
  label: string;
  /** dominant cover, which feedback calibrates */
  dom: Cover;
  /** predicted hours to target */
  predH: number;
  /** calibration multiplier of `dom` when saved */
  calUsed: number;
  /** working window start / end, hours after throwing (NaN → null in JSON) */
  ws: number | null;
  we: number | null;
  fb: StoredFeedback | null;
}

export interface StoredFeedback {
  kind: FeedbackKind;
  /** hours from throwing to the feedback */
  actualH: number;
  /** calibration sample value (see domain/calibration) */
  sample: number;
  /** epoch ms of the feedback */
  at: number;
}

export interface PieceRepository {
  load(): StoredPiece[];
  save(pieces: StoredPiece[]): void;
}

export const STORAGE_KEY = 'kiedy-trymowac-v1';

interface StoreDocument {
  pieces: StoredPiece[];
}

/**
 * localStorage-backed repository. Mirrors the prototype exactly: unknown top-level keys are kept,
 * unreadable JSON is ignored, and storage errors (quota, privacy mode) are swallowed.
 */
export class LocalStoragePieceRepository implements PieceRepository {
  private doc: StoreDocument = { pieces: [] };

  constructor(
    private readonly storage: Pick<Storage, 'getItem' | 'setItem'> = localStorage,
    private readonly key: string = STORAGE_KEY,
  ) {}

  load(): StoredPiece[] {
    try {
      const s = this.storage.getItem(this.key);
      if (s) this.doc = (JSON.parse(s) as StoreDocument | null) || this.doc;
    } catch {
      // ignore unreadable data
    }
    if (!Array.isArray(this.doc.pieces)) this.doc.pieces = [];
    return this.doc.pieces;
  }

  save(pieces: StoredPiece[]): void {
    this.doc.pieces = pieces;
    try {
      this.storage.setItem(this.key, JSON.stringify(this.doc));
    } catch {
      // ignore quota / privacy-mode errors
    }
  }
}

/** Calibration samples contained in the saved feedback. */
export const calibrationSamples = (pieces: readonly StoredPiece[]): CalibrationSample[] =>
  pieces.filter((p) => p.fb).map((p) => ({ cover: p.dom, value: p.fb!.sample }));
