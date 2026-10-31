// The level file format, shared by the game, the level editor and
// scripts/build-levels.ts. This file must not import anything, so plain Node
// can run the level-building scripts with it.

export const LEVEL_FORMAT_VERSION = 1;

export type Vec3 = [number, number, number];
export type Theme = 'house' | 'backyard' | 'city';
export const THEMES: readonly Theme[] = ['house', 'backyard', 'city'];

/** Biggest level the game will load (the editor uses a smaller limit). */
export const MAX_LEVEL_SIZE: Vec3 = [128, 64, 128];

export interface LevelObject {
  type: string;
  /** Block cell the object sits in (for the start point: where the cat's feet go). */
  pos: Vec3;
  /** Second point for moving platforms and enemy patrols. */
  to?: Vec3;
  /** Facing direction in degrees (0 = looking toward -Z). */
  yaw?: number;
}

export interface LevelFile {
  version: number;
  name: string;
  theme: Theme;
  /** [width x, height y, depth z] in blocks. */
  size: Vec3;
  /** Block names used by this level. palette[0] is always "air". */
  palette: string[];
  /** Run-length pairs [paletteIndex, count, ...] over cells in x, then z, then y order. */
  blocks: number[];
  objects: LevelObject[];
}

export function cellIndex(size: Vec3, x: number, y: number, z: number): number {
  return x + size[0] * (z + size[2] * y);
}

export function encodeRle(cells: ArrayLike<number>): number[] {
  const out: number[] = [];
  let i = 0;
  while (i < cells.length) {
    const value = cells[i];
    let count = 1;
    while (i + count < cells.length && cells[i + count] === value) count++;
    out.push(value, count);
    i += count;
  }
  return out;
}

export function decodeRle(rle: readonly number[], total: number): Uint8Array {
  const out = new Uint8Array(total);
  let p = 0;
  for (let i = 0; i < rle.length; i += 2) {
    const value = rle[i];
    const count = rle[i + 1];
    if (p + count > total) throw new Error('The level has more blocks than its size allows.');
    out.fill(value, p, p + count);
    p += count;
  }
  if (p !== total) throw new Error('The level has fewer blocks than its size needs.');
  return out;
}

const isInt = (v: unknown): v is number => typeof v === 'number' && Number.isInteger(v);
const isVec3 = (v: unknown): v is Vec3 =>
  Array.isArray(v) && v.length === 3 && v.every((n) => typeof n === 'number' && Number.isFinite(n));

/** Returns a list of problems. An empty list means the level is fine to load. */
export function validateLevel(data: unknown): string[] {
  const errors: string[] = [];
  if (typeof data !== 'object' || data === null) return ['The level file is not a level.'];
  const d = data as Record<string, unknown>;

  if (d.version !== LEVEL_FORMAT_VERSION) errors.push(`Unknown level version: ${String(d.version)}.`);
  if (typeof d.name !== 'string') errors.push('The level needs a name.');
  if (!THEMES.includes(d.theme as Theme)) errors.push(`Unknown theme: ${String(d.theme)}.`);

  const size = d.size;
  const sizeOk =
    isVec3(size) && size.every((n, i) => isInt(n) && n > 0 && n <= MAX_LEVEL_SIZE[i]);
  if (!sizeOk) errors.push('The level size is missing or too big.');

  const palette = d.palette;
  const paletteOk =
    Array.isArray(palette) && palette.length > 0 && palette.length <= 256 &&
    palette.every((p) => typeof p === 'string') && palette[0] === 'air';
  if (!paletteOk) errors.push('The block palette must be a list of names starting with "air".');

  const blocks = d.blocks;
  if (!Array.isArray(blocks) || blocks.length % 2 !== 0 || !blocks.every((n) => isInt(n) && n >= 0)) {
    errors.push('The blocks list is broken.');
  } else if (sizeOk && paletteOk) {
    const volume = size[0] * size[1] * size[2];
    let total = 0;
    for (let i = 0; i < blocks.length; i += 2) {
      if (blocks[i] >= palette.length) {
        errors.push('The blocks list uses a block that is not in the palette.');
        break;
      }
      total += blocks[i + 1];
    }
    if (total !== volume) errors.push(`The level should have ${volume} cells but has ${total}.`);
  }

  if (!Array.isArray(d.objects)) {
    errors.push('The level needs an objects list.');
  } else {
    d.objects.forEach((o, i) => {
      const obj = o as Record<string, unknown> | null;
      if (!obj || typeof obj.type !== 'string' || !isVec3(obj.pos)) {
        errors.push(`Object ${i + 1} needs a type and a position.`);
      } else if (obj.to !== undefined && !isVec3(obj.to)) {
        errors.push(`Object ${i + 1} has a broken "to" position.`);
      }
    });
  }
  return errors;
}

/** Helper for building levels in code: set and fill blocks by name, then export. */
export class GridBuilder {
  readonly size: Vec3;
  readonly cells: Uint8Array;
  readonly palette: string[] = ['air'];
  readonly objects: LevelObject[] = [];

  constructor(size: Vec3) {
    this.size = size;
    this.cells = new Uint8Array(size[0] * size[1] * size[2]);
  }

  private paletteIndex(name: string): number {
    let i = this.palette.indexOf(name);
    if (i < 0) {
      this.palette.push(name);
      i = this.palette.length - 1;
    }
    return i;
  }

  set(x: number, y: number, z: number, name: string): void {
    const [sx, sy, sz] = this.size;
    if (x < 0 || y < 0 || z < 0 || x >= sx || y >= sy || z >= sz) return;
    this.cells[cellIndex(this.size, x, y, z)] = this.paletteIndex(name);
  }

  /** Fills the box between two corners, both included. */
  fill(x0: number, y0: number, z0: number, x1: number, y1: number, z1: number, name: string): void {
    for (let y = Math.min(y0, y1); y <= Math.max(y0, y1); y++)
      for (let z = Math.min(z0, z1); z <= Math.max(z0, z1); z++)
        for (let x = Math.min(x0, x1); x <= Math.max(x0, x1); x++) this.set(x, y, z, name);
  }

  add(obj: LevelObject): void {
    this.objects.push(obj);
  }

  toLevel(name: string, theme: Theme): LevelFile {
    return {
      version: LEVEL_FORMAT_VERSION,
      name,
      theme,
      size: [...this.size],
      palette: [...this.palette],
      blocks: encodeRle(this.cells),
      objects: this.objects.map((o) => ({ ...o })),
    };
  }
}
