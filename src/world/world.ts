import { AIR, isSolid } from './blocks';

/** The block grid. Cells outside the grid read as air. */
export class World {
  readonly sx: number;
  readonly sy: number;
  readonly sz: number;
  readonly cells: Uint8Array;

  constructor(sx: number, sy: number, sz: number, cells?: Uint8Array) {
    this.sx = sx;
    this.sy = sy;
    this.sz = sz;
    this.cells = cells ?? new Uint8Array(sx * sy * sz);
    if (this.cells.length !== sx * sy * sz) throw new Error('World cells do not match its size.');
  }

  inBounds(x: number, y: number, z: number): boolean {
    return x >= 0 && y >= 0 && z >= 0 && x < this.sx && y < this.sy && z < this.sz;
  }

  get(x: number, y: number, z: number): number {
    if (!this.inBounds(x, y, z)) return AIR;
    return this.cells[x + this.sx * (z + this.sz * y)];
  }

  set(x: number, y: number, z: number, id: number): void {
    if (!this.inBounds(x, y, z)) return;
    this.cells[x + this.sx * (z + this.sz * y)] = id;
  }

  isSolid(x: number, y: number, z: number): boolean {
    return isSolid(this.get(x, y, z));
  }
}
