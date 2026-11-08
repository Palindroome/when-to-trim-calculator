import { describe, expect, it } from 'vitest';
import { STORAGE_KEY, LocalStoragePieceRepository, calibrationSamples, type StoredPiece } from './pieces';

class MemoryStorage {
  data = new Map<string, string>();
  getItem(k: string): string | null {
    return this.data.get(k) ?? null;
  }
  setItem(k: string, v: string): void {
    this.data.set(k, v);
  }
}

const piece = (over: Partial<StoredPiece> = {}): StoredPiece => ({
  id: 'a',
  name: 'x',
  start: 0,
  mass: 500,
  lossPct: 6,
  plan: [{ w: 'open', h: null }],
  label: 'l',
  dom: 'open',
  predH: 5,
  calUsed: 1,
  ws: 1,
  we: 2,
  fb: null,
  ...over,
});

describe('LocalStoragePieceRepository', () => {
  it('starts empty and writes the v1 document', () => {
    const s = new MemoryStorage();
    const repo = new LocalStoragePieceRepository(s);
    expect(repo.load()).toEqual([]);
    repo.save([piece({ ws: NaN })]);
    const raw = s.getItem(STORAGE_KEY)!;
    expect(JSON.parse(raw)).toEqual({ pieces: [{ ...piece(), ws: null }] });
    expect(raw.startsWith('{"pieces":[{"id":"a","name":"x","start":0,')).toBe(true);
  });

  it.each(['{broken', 'null', '{"pieces":42}', '{}'])('tolerates %s', (raw) => {
    const s = new MemoryStorage();
    s.setItem(STORAGE_KEY, raw);
    expect(new LocalStoragePieceRepository(s).load()).toEqual([]);
  });

  it('keeps unknown top-level keys', () => {
    const s = new MemoryStorage();
    s.setItem(STORAGE_KEY, JSON.stringify({ pieces: [piece()], extra: 1 }));
    const repo = new LocalStoragePieceRepository(s);
    const list = repo.load();
    expect(list).toHaveLength(1);
    repo.save([]);
    expect(JSON.parse(s.getItem(STORAGE_KEY)!)).toEqual({ pieces: [], extra: 1 });
  });

  it('swallows storage errors', () => {
    const failing = {
      getItem: (): string | null => {
        throw new Error('denied');
      },
      setItem: (): void => {
        throw new Error('quota');
      },
    };
    const repo = new LocalStoragePieceRepository(failing);
    expect(repo.load()).toEqual([]);
    expect(() => repo.save([piece()])).not.toThrow();
  });
});

describe('calibrationSamples', () => {
  it('takes rated pieces, attributed to their dominant cover', () => {
    expect(
      calibrationSamples([
        piece(),
        piece({ dom: 'full', fb: { kind: 'ok', actualH: 3, sample: 1.2, at: 0 } }),
      ]),
    ).toEqual([{ cover: 'full', value: 1.2 }]);
  });
});
