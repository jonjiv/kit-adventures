// Builds a winding, hedge-lined path one segment at a time.
//
// Inside a segment, positions are path-local: `s` goes across the path (0 is
// the middle, negative is left) and `f` goes forward along it from the start
// of the segment. Heights are absolute. Turns are 90 degrees left or right.
//
// The cat can never leave the path: both sides are hedges (no grip, so no
// wall runs or wall jumps on them) with invisible barriers up to the sky.

import { LevelBuilder, type LevelFile, type MaterialName, type PropName, type Theme } from '../src/world/levelFormat.ts';

/** Forward directions (x, z) for headings 0 = north (-z), 1 = east, 2 = south, 3 = west. */
const DIRS: readonly [number, number][] = [[0, -1], [1, 0], [0, 1], [-1, 0]];
/** Level yaw (degrees) for looking along each heading. */
const YAWS = [0, -90, 180, 90];

export interface Rect { x0: number; z0: number; x1: number; z1: number }

const overlapArea = (a: Rect, b: Rect) =>
  Math.max(0, Math.min(a.x1, b.x1) - Math.max(a.x0, b.x0)) * Math.max(0, Math.min(a.z1, b.z1) - Math.max(a.z0, b.z0));

function rng(seed: number) {
  return () => {
    seed = (seed * 16807) % 2147483647;
    return (seed - 1) / 2147483646;
  };
}

export class PathBuilder {
  readonly L = new LevelBuilder([1, 1, 1]);
  /** Half the walkable width. */
  readonly half: number;
  readonly hedge = 2;
  /** Height of the bottom of pits. */
  readonly base = 0;
  /** Height of the ground outside the path. */
  readonly ground: number;
  /** Current floor height of the path. */
  H: number;
  /** Footprints of every segment and corner (with hedges), in world space. */
  readonly footprints: Rect[] = [];
  /** Scenery spots outside the hedges that the cat must never be able to reach. */
  readonly outside: [number, number][] = [];
  /** Where the path ends (for tests). */
  goal: [number, number, number] = [0, 0, 0];

  private pits: Rect[] = [];
  private ox = 0;
  private oz = 0;
  private k = 0;
  private segTop = 0;

  constructor(opts: { width?: number; ground?: number; startHeight?: number } = {}) {
    this.half = (opts.width ?? 10) / 2;
    this.ground = opts.ground ?? 8;
    this.H = opts.startHeight ?? 10;
  }

  get yaw(): number {
    return YAWS[this.k];
  }

  /** World x, z for a path-local spot. */
  world(s: number, f: number): [number, number] {
    const [fx, fz] = DIRS[this.k];
    const [rx, rz] = DIRS[(this.k + 1) % 4];
    return [this.ox + rx * s + fx * f, this.oz + rz * s + fz * f];
  }

  private rect(s0: number, f0: number, s1: number, f1: number): Rect {
    const [ax, az] = this.world(s0, f0);
    const [bx, bz] = this.world(s1, f1);
    return { x0: Math.min(ax, bx), z0: Math.min(az, bz), x1: Math.max(ax, bx), z1: Math.max(az, bz) };
  }

  // ------------------------------------------------------------ pieces in path-local space

  block(
    s0: number, f0: number, s1: number, f1: number, y0: number, y1: number,
    mat: MaterialName, opts: { round?: number; solid?: boolean } = {},
  ): void {
    const r = this.rect(s0, f0, s1, f1);
    this.L.box(r.x0, y0, r.z0, r.x1, y1, r.z1, mat, opts);
    this.segTop = Math.max(this.segTop, y1);
  }

  /**
   * Path floor across the whole width from f0 to f1: dirt with a 0.4 m top
   * layer stacked on it. The two must only touch, never overlap, or their
   * sides lie on the same plane and flicker.
   */
  floor(f0: number, f1: number, top = this.H, mat: MaterialName = 'grass'): void {
    const h = this.half;
    const layer = Math.max(top - 0.4, this.ground);
    if (layer > this.ground) this.block(-h, f0, h, f1, this.ground, layer, 'dirt', { round: 0.05 });
    this.block(-h, f0, h, f1, layer, top, mat);
  }

  /** A hole across the path, with water at the bottom. Falling in means back to the last checkpoint. */
  pit(f0: number, f1: number): void {
    const h = this.half, w = this.hedge;
    // The hole in the ground reaches under the hedges, so the pit's sides are
    // only hedge (ground and hedge on the same plane would flicker).
    this.pits.push(this.rect(-h - w, f0, h + w, f1));
    // Water sits a little inside the hole for the same reason.
    const r = this.rect(-h, f0, h, f1), e = 0.03;
    this.L.water(r.x0 + e, this.base + e, r.z0 + e, r.x1 - e, this.base + 0.8, r.z1 - e);
  }

  /** Upright cylinder from the bottom of the pit up to `top`. */
  pillar(s: number, f: number, radius: number, top: number, mat: MaterialName = 'bark'): void {
    const [x, z] = this.world(s, f);
    this.L.cylinder(x, this.base, z, radius, top - this.base, mat);
    this.segTop = Math.max(this.segTop, top);
  }

  prop(prop: PropName, s: number, f: number, y = this.H, rot = 0, scale?: number): void {
    const [x, z] = this.world(s, f);
    this.L.prop(prop, x, y, z, rot, scale);
  }

  /** A sign near the left edge, facing the player. */
  sign(f: number, text: string, s = -this.half + 1.2): void {
    const [x, z] = this.world(s, f);
    this.L.add({ type: 'sign', pos: [x, this.H, z], yaw: this.yaw, text });
  }

  checkpoint(f: number, s = 0): void {
    const [x, z] = this.world(s, f);
    this.L.add({ type: 'checkpoint', pos: [x, this.H, z], yaw: this.yaw });
  }

  start(f: number): void {
    const [x, z] = this.world(0, f);
    this.L.add({ type: 'start', pos: [x, this.H, z], yaw: this.yaw });
  }

  // ------------------------------------------------------------ segments and turns

  private addFootprint(r: Rect): void {
    // Neighbors touch at corners; anything bigger means the path runs into itself.
    for (const other of this.footprints.slice(0, -2)) {
      if (overlapArea(r, other) > 5) throw new Error('The path runs into itself. Change the turns or lengths.');
    }
    this.footprints.push(r);
  }

  private hedges(s0: number, s1: number, f0: number, f1: number, top: number): void {
    const r = this.rect(s0, f0, s1, f1);
    this.L.wall(r.x0, this.base, r.z0, r.x1, top, r.z1, 'leaves', { round: 0.35 });
  }

  /** A straight stretch of path `len` long. `build` places floors, pits and obstacles inside it. */
  segment(len: number, build: () => void): void {
    this.segTop = this.H;
    build();
    const h = this.half, w = this.hedge, top = this.segTop + 5;
    this.hedges(-h - w, -h, 0, len, top);
    this.hedges(h, h + w, 0, len, top);
    this.addFootprint(this.rect(-h - w, 0, h + w, len));
    [this.ox, this.oz] = this.world(0, len);
  }

  /** A square corner turning left or right, with rounded hedges. Optionally a checkpoint in it. */
  turn(dir: 'left' | 'right', checkpoint = false): void {
    const h = this.half, w = this.hedge, W = h * 2;
    const side = dir === 'right' ? 1 : -1;
    this.segTop = this.H;
    this.floor(0, W);
    const top = this.H + 5;
    this.hedges(-h - w, h + w, W, W + w, top); // far side
    if (side > 0) this.hedges(-h - w, -h, 0, W + w, top);
    else this.hedges(h, h + w, 0, W + w, top);
    // Big round hedges soften the corners so it reads as a curve.
    const [cx, cz] = this.world(-side * h, W);
    this.L.cylinder(cx, this.base, cz, 3, top - this.base, 'leaves');
    const [ix, iz] = this.world(side * h, 0);
    this.L.cylinder(ix, this.base, iz, 1.2, top - this.base, 'leaves');
    this.addFootprint(this.rect(-h - w, 0, h + w, W + w));

    [this.ox, this.oz] = this.world(side * h, h);
    this.k = (this.k + (side > 0 ? 1 : 3)) % 4;
    if (checkpoint) {
      // In the middle of the corner, facing the new direction.
      const [x, z] = this.world(0, -h);
      this.L.add({ type: 'checkpoint', pos: [x, this.H, z], yaw: this.yaw });
    }
  }

  /** Closes the end (or, with behind = true, the start) of the path with a hedge. */
  cap(behind = false): void {
    const h = this.half, w = this.hedge;
    this.segTop = this.H;
    if (behind) this.hedges(-h - w, h + w, -w, 0, this.H + 5);
    else this.hedges(-h - w, h + w, 0, w, this.H + 5);
  }

  // ------------------------------------------------------------ ground, scenery and output

  /** Ground outside the path (with holes for the pits), plus trees, bushes, rocks and flowers. */
  private landscape(seed: number): void {
    const margin = 30;
    const box = {
      x0: Math.min(...this.footprints.map((r) => r.x0)) - margin,
      z0: Math.min(...this.footprints.map((r) => r.z0)) - margin,
      x1: Math.max(...this.footprints.map((r) => r.x1)) + margin,
      z1: Math.max(...this.footprints.map((r) => r.z1)) + margin,
    };
    this.L.box(box.x0, this.base - 1, box.z0, box.x1, this.base, box.z1, 'dirt', { round: 0 });

    // Ground = the big box minus the pits, cut into strips along x. Holes are
    // 2 cm wider than the pits so the ground's cut edges sit just behind any
    // hedge or wall at the pit's edge instead of on the same plane (flicker).
    const e = 0.02;
    const pits = this.pits.map((p) => ({ x0: p.x0 - e, z0: p.z0 - e, x1: p.x1 + e, z1: p.z1 + e }));
    const xs = [...new Set([box.x0, box.x1, ...pits.flatMap((p) => [p.x0, p.x1])])].sort((a, b) => a - b);
    for (let i = 0; i < xs.length - 1; i++) {
      const xa = xs[i], xb = xs[i + 1];
      const holes = pits.filter((p) => p.x0 <= xa && p.x1 >= xb).map((p) => [p.z0, p.z1]).sort((a, b) => a[0] - b[0]);
      let z = box.z0;
      for (const [h0, h1] of [...holes, [box.z1, box.z1]]) {
        if (h0 > z) {
          this.L.box(xa, this.base, z, xb, this.ground - 0.3, h0, 'dirt', { round: 0 });
          this.L.box(xa, this.ground - 0.3, z, xb, this.ground, h0, 'grass', { round: 0 });
        }
        z = Math.max(z, h1);
      }
    }

    const r = rng(seed);
    const nearPath = (x: number, z: number, pad: number) =>
      this.footprints.some((f) => x > f.x0 - pad && x < f.x1 + pad && z > f.z0 - pad && z < f.z1 + pad);
    const area = (box.x1 - box.x0) * (box.z1 - box.z0);
    for (let i = 0; i < area / 90; i++) {
      const x = box.x0 + r() * (box.x1 - box.x0), z = box.z0 + r() * (box.z1 - box.z0);
      if (nearPath(x, z, 3)) continue;
      const roll = r();
      const prop: PropName = roll < 0.45 ? 'tree' : roll < 0.7 ? 'bush' : roll < 0.85 ? 'flowers' : 'rock';
      this.L.prop(prop, x, this.ground, z, Math.floor(r() * 4) * 90, prop === 'tree' ? 1.3 + r() * 0.8 : undefined);
      this.outside.push([x, z]);
    }
  }

  build(name: string, theme: Theme, seed = 1): LevelFile {
    this.landscape(seed);
    this.L.killY = this.ground - 3;
    const minX = Math.min(...this.footprints.map((r) => r.x0)) - 30;
    const minZ = Math.min(...this.footprints.map((r) => r.z0)) - 30;
    this.L.fitToContent(2);
    // fitToContent moved everything; move the test spots the same way.
    const dx = 2 - minX, dz = 2 - minZ;
    for (const p of this.outside) { p[0] += dx; p[1] += dz; }
    this.goal = [this.goal[0] + dx, this.goal[1], this.goal[2] + dz];
    return this.L.toLevel(name, theme);
  }

  /** Remembers a spot (path-local) as the end of the level, for tests. */
  markGoal(s: number, f: number): void {
    const [x, z] = this.world(s, f);
    this.goal = [x, this.H, z];
  }
}
