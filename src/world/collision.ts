// Axis-aligned boxes the cat collides with, stored in a grid of columns so
// lookups only check nearby boxes. No Three.js here so it runs in unit tests.

import type { Vec3 } from './levelFormat';

export interface Collider {
  min: Vec3;
  max: Vec3;
  /** False for invisible barriers, so they don't push the camera around. */
  blocksCamera: boolean;
}

const CELL = 4;

export class CollisionWorld {
  readonly colliders: Collider[];
  private cells = new Map<string, number[]>();
  private stamp = 0;
  private stamps: Uint32Array;

  constructor(colliders: Collider[]) {
    this.colliders = colliders;
    this.stamps = new Uint32Array(colliders.length);
    colliders.forEach((c, i) => {
      for (let cx = Math.floor(c.min[0] / CELL); cx <= Math.floor(c.max[0] / CELL); cx++) {
        for (let cz = Math.floor(c.min[2] / CELL); cz <= Math.floor(c.max[2] / CELL); cz++) {
          const key = `${cx},${cz}`;
          const list = this.cells.get(key);
          if (list) list.push(i);
          else this.cells.set(key, [i]);
        }
      }
    });
  }

  /** Calls fn for every collider whose x/z footprint touches the area (each once). */
  private forEachNear(minX: number, minZ: number, maxX: number, maxZ: number, fn: (c: Collider) => void): void {
    this.stamp++;
    for (let cx = Math.floor(minX / CELL); cx <= Math.floor(maxX / CELL); cx++) {
      for (let cz = Math.floor(minZ / CELL); cz <= Math.floor(maxZ / CELL); cz++) {
        const list = this.cells.get(`${cx},${cz}`);
        if (!list) continue;
        for (const i of list) {
          if (this.stamps[i] === this.stamp) continue;
          this.stamps[i] = this.stamp;
          fn(this.colliders[i]);
        }
      }
    }
  }

  /** Colliders overlapping the box (touching edges don't count). */
  overlapping(min: Vec3, max: Vec3): Collider[] {
    const out: Collider[] = [];
    const e = 1e-5;
    this.forEachNear(min[0], min[2], max[0], max[2], (c) => {
      if (
        min[0] < c.max[0] - e && max[0] > c.min[0] + e &&
        min[1] < c.max[1] - e && max[1] > c.min[1] + e &&
        min[2] < c.max[2] - e && max[2] > c.min[2] + e
      ) out.push(c);
    });
    return out;
  }

  /**
   * Distance along a ray (dir must be normalized) to the first collider that
   * blocks the camera, with colliders grown by pad. Colliders the ray starts
   * inside are ignored. Returns maxDist if nothing is hit.
   */
  raycastCamera(origin: Vec3, dir: Vec3, maxDist: number, pad: number): number {
    const end = origin.map((o, i) => o + dir[i] * maxDist);
    let best = maxDist;
    this.forEachNear(
      Math.min(origin[0], end[0]) - pad, Math.min(origin[2], end[2]) - pad,
      Math.max(origin[0], end[0]) + pad, Math.max(origin[2], end[2]) + pad,
      (c) => {
        if (!c.blocksCamera) return;
        let tNear = -Infinity, tFar = Infinity;
        for (let a = 0; a < 3; a++) {
          const lo = c.min[a] - pad, hi = c.max[a] + pad;
          if (Math.abs(dir[a]) < 1e-9) {
            if (origin[a] < lo || origin[a] > hi) return;
          } else {
            let t0 = (lo - origin[a]) / dir[a], t1 = (hi - origin[a]) / dir[a];
            if (t0 > t1) [t0, t1] = [t1, t0];
            tNear = Math.max(tNear, t0);
            tFar = Math.min(tFar, t1);
            if (tNear > tFar) return;
          }
        }
        if (tNear >= 0 && tNear < best) best = tNear;
      },
    );
    return best;
  }

  /** Height of the highest surface at or below y under the square footprint, or null over a pit. */
  groundBelow(x: number, z: number, y: number, half: number): number | null {
    let best: number | null = null;
    this.forEachNear(x - half, z - half, x + half, z + half, (c) => {
      if (c.min[0] >= x + half || c.max[0] <= x - half || c.min[2] >= z + half || c.max[2] <= z - half) return;
      if (!c.blocksCamera) return; // barriers are invisible, don't put shadows on them
      if (c.max[1] <= y + 0.01 && (best === null || c.max[1] > best)) best = c.max[1];
    });
    return best;
  }
}
