// Builds a winding, hedge-lined path one segment at a time.
//
// Inside a segment, positions are path-local: `s` goes across the path (0 is
// the middle, negative is left) and `f` goes forward along it from the start
// of the segment. Heights are absolute. Turns are 90 degrees left or right.
//
// The cat can never leave the path: both sides are walls without grip
// (hedges, glass or force fields, so no wall runs or wall jumps on them) with
// invisible barriers up to the sky.
//
// A style gives each level its look: obstacles are written with garden
// materials (grass, dirt, wood...) and the style swaps them.

import { LevelBuilder, SEE_THROUGH, type LevelFile, type MaterialName, type PropName, type Theme, type ZoneKind } from '../src/world/levelFormat.ts';

/** Forward directions (x, z) for headings 0 = north (-z), 1 = east, 2 = south, 3 = west. */
const DIRS: readonly [number, number][] = [[0, -1], [1, 0], [0, 1], [-1, 0]];
/** Level yaw (degrees) for looking along each heading. */
const YAWS = [0, -90, 180, 90];

export interface Rect { x0: number; z0: number; x1: number; z1: number }

export interface PathStyle {
  /** Material swaps for everything the obstacles build (garden materials in, this level's out). */
  swap: Partial<Record<MaterialName, MaterialName>>;
  /** Prop swaps; null leaves the prop out. */
  props: Partial<Record<PropName, PropName | null>>;
  /** The path's side walls. Must be a no-grip material (see NO_GRIP). */
  side: MaterialName;
  sideRound: number;
  /** Ground outside the path: the top layer and what's under it. */
  groundTop: MaterialName;
  groundUnder: MaterialName;
  /** Pits have water at the bottom (otherwise they're just a long drop). */
  pitWater: boolean;
  scenery: 'garden' | 'city' | 'moon';
  /** Big soft hills of the ground material outside the path. */
  hills: boolean;
}

export const GARDEN_STYLE: PathStyle = {
  swap: {}, props: {}, side: 'leaves', sideRound: 0.35,
  groundTop: 'grass', groundUnder: 'dirt', pitWater: true, scenery: 'garden', hills: true,
};

/** Rooftops: concrete roofs on buildings, glass walls, skyscrapers all around, gaps down to the street. */
export const CITY_STYLE: PathStyle = {
  swap: { grass: 'stone', dirt: 'building', wood: 'metal', bark: 'metal', leaves: 'glass' },
  props: { flowers: 'bush' },
  side: 'glass', sideRound: 0.04,
  groundTop: 'asphalt', groundUnder: 'stone', pitWater: false, scenery: 'city', hills: false,
};

/** Moon base: dusty paths between glowing force fields, with space-station panels and metal walls. */
export const MOON_STYLE: PathStyle = {
  swap: { grass: 'moondust', dirt: 'moonrock', stone: 'moonrock', wood: 'panel', brick: 'metal', bark: 'metal', leaves: 'forcefield' },
  props: { flowers: null, tree: null, bush: 'rock' },
  side: 'forcefield', sideRound: 0.04,
  groundTop: 'moondust', groundUnder: 'moonrock', pitWater: false, scenery: 'moon', hills: true,
};

const overlapArea = (a: Rect, b: Rect) =>
  Math.max(0, Math.min(a.x1, b.x1) - Math.max(a.x0, b.x0)) * Math.max(0, Math.min(a.z1, b.z1) - Math.max(a.z0, b.z0));

/** Repeatable random numbers from 0 to 1. */
export function rng(seed: number) {
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
  /** What the path is made of, in order (obstacle names, "hill", "left", "right"), for tests. */
  readonly plan: string[] = [];
  /** Where the path ends (for tests). */
  goal: [number, number, number] = [0, 0, 0];

  readonly style: PathStyle;
  private pits: Rect[] = [];
  private hillRects: Rect[] = [];
  private ox = 0;
  private oz = 0;
  private k = 0;
  private segTop = 0;

  constructor(opts: { width?: number; ground?: number; startHeight?: number; style?: PathStyle } = {}) {
    this.style = opts.style ?? GARDEN_STYLE;
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
    this.L.box(r.x0, y0, r.z0, r.x1, y1, r.z1, this.mat(mat), opts);
    this.segTop = Math.max(this.segTop, y1);
  }

  /**
   * Path floor across the whole width from f0 to f1: dirt with a 0.4 m top
   * layer stacked on it. The two must only touch, never overlap, or their
   * sides lie on the same plane and flicker.
   *
   * Behind see-through walls (glass, force fields) the floor stops 2 cm short
   * of them, so its sides never line up with an obstacle wall built at the
   * path's edge. Hedges hide that, so garden floors go right up to them.
   */
  floor(f0: number, f1: number, top = this.H, mat: MaterialName = 'grass'): void {
    const h = SEE_THROUGH.includes(this.style.side) ? this.half - 0.02 : this.half;
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
    if (!this.style.pitWater) return;
    const r = this.rect(-h, f0, h, f1), e = 0.03;
    this.L.water(r.x0 + e, this.base + e, r.z0 + e, r.x1 - e, this.base + 0.8, r.z1 - e);
  }

  /** Upright cylinder from the bottom of the pit up to `top`. */
  pillar(s: number, f: number, radius: number, top: number, mat: MaterialName = 'bark'): void {
    const [x, z] = this.world(s, f);
    this.L.cylinder(x, this.base, z, radius, top - this.base, this.mat(mat));
    this.segTop = Math.max(this.segTop, top);
  }

  /** Upright cylinder from y0, `height` tall. */
  disc(s: number, f: number, radius: number, y0: number, height: number, mat: MaterialName): void {
    const [x, z] = this.world(s, f);
    this.L.cylinder(x, y0, z, radius, height, this.mat(mat));
    this.segTop = Math.max(this.segTop, y0 + height);
  }

  /** An updraft or low-gravity area (path-local corners, absolute heights). */
  zone(kind: ZoneKind, s0: number, f0: number, s1: number, f1: number, y0: number, y1: number): void {
    const r = this.rect(s0, f0, s1, f1);
    this.L.add({ type: kind, pos: [r.x0, y0, r.z0], to: [r.x1, y1, r.z1] });
  }

  prop(prop: PropName, s: number, f: number, y = this.H, rot = 0, scale?: number): void {
    const swapped = prop in this.style.props ? this.style.props[prop] : prop;
    if (!swapped) return;
    const [x, z] = this.world(s, f);
    this.L.prop(swapped, x, y, z, rot, scale);
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

  /** This level's material for a garden material. */
  mat(m: MaterialName): MaterialName {
    return this.style.swap[m] ?? m;
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
    this.L.wall(r.x0, this.base, r.z0, r.x1, top, r.z1, this.style.side, { round: this.style.sideRound });
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
    this.L.cylinder(cx, this.base, cz, 3, top - this.base, this.style.side);
    const [ix, iz] = this.world(side * h, 0);
    this.L.cylinder(ix, this.base, iz, 1.2, top - this.base, this.style.side);
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

  /** Ground outside the path (with holes for the pits), plus scenery. */
  private landscape(seed: number): void {
    const margin = 30;
    const box = {
      x0: Math.min(...this.footprints.map((r) => r.x0)) - margin,
      z0: Math.min(...this.footprints.map((r) => r.z0)) - margin,
      x1: Math.max(...this.footprints.map((r) => r.x1)) + margin,
      z1: Math.max(...this.footprints.map((r) => r.z1)) + margin,
    };
    const st = this.style;
    this.L.box(box.x0, this.base - 1, box.z0, box.x1, this.base, box.z1, st.groundUnder, { round: 0 });

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
          this.L.box(xa, this.base, z, xb, this.ground - 0.3, h0, st.groundUnder, { round: 0 });
          this.L.box(xa, this.ground - 0.3, z, xb, this.ground, h0, st.groundTop, { round: 0 });
        }
        z = Math.max(z, h1);
      }
    }

    const r = rng(seed);
    if (st.hills) this.rollingHills(box, r);
    if (st.scenery === 'city') this.cityScenery(box, r);
    else if (st.scenery === 'moon') this.moonScenery(box, r);
    else this.gardenScenery(box, r);
  }

  /** True if a spot is within `pad` meters of the path. */
  private nearPath(x: number, z: number, pad: number): boolean {
    return this.footprints.some((f) => x > f.x0 - pad && x < f.x1 + pad && z > f.z0 - pad && z < f.z1 + pad);
  }

  /** True if a rectangle comes within `pad` meters of the path. */
  private rectNearPath(a: Rect, pad: number): boolean {
    return this.footprints.some((f) => a.x1 > f.x0 - pad && a.x0 < f.x1 + pad && a.z1 > f.z0 - pad && a.z0 < f.z1 + pad);
  }

  /** True if a spot is on one of the rolling hills. */
  private onHill(x: number, z: number, pad = 1): boolean {
    return this.hillRects.some((h) => x > h.x0 - pad && x < h.x1 + pad && z > h.z0 - pad && z < h.z1 + pad);
  }

  /** Soft, rounded hills (one or two humps) away from the path. */
  private rollingHills(box: Rect, r: () => number): void {
    const g = this.ground, mat = this.style.groundTop;
    const area = (box.x1 - box.x0) * (box.z1 - box.z0);
    for (let i = 0; i < area / 900; i++) {
      const w = 10 + r() * 18, d = 8 + r() * 16, h = 2 + r() * 4;
      const x = box.x0 + r() * (box.x1 - box.x0 - w), z = box.z0 + r() * (box.z1 - box.z0 - d);
      const a: Rect = { x0: x, z0: z, x1: x + w, z1: z + d };
      if (this.rectNearPath(a, 6)) continue;
      this.L.box(a.x0, g, a.z0, a.x1, g + h, a.z1, mat, { round: h / 2 });
      if (r() < 0.6) {
        // A second, smaller hump on top, starting inside the first so no faces line up.
        const cx = x + w * (0.3 + r() * 0.4), cz = z + d * (0.3 + r() * 0.4), hw = w * 0.28, hd = d * 0.28, y0 = g + h * 0.45;
        this.L.box(cx - hw, y0, cz - hd, cx + hw, y0 + h * 0.95, cz + hd, mat, { round: h * 0.45 });
      }
      this.hillRects.push(a);
    }
  }

  /** Trees, bushes, rocks and flowers. */
  private gardenScenery(box: Rect, r: () => number): void {
    const area = (box.x1 - box.x0) * (box.z1 - box.z0);
    for (let i = 0; i < area / 90; i++) {
      const x = box.x0 + r() * (box.x1 - box.x0), z = box.z0 + r() * (box.z1 - box.z0);
      if (this.nearPath(x, z, 3) || this.onHill(x, z)) continue;
      const roll = r();
      const prop: PropName = roll < 0.45 ? 'tree' : roll < 0.7 ? 'bush' : roll < 0.85 ? 'flowers' : 'rock';
      this.L.prop(prop, x, this.ground, z, Math.floor(r() * 4) * 90, prop === 'tree' ? 1.3 + r() * 0.8 : undefined);
      this.outside.push([x, z]);
    }
  }

  /**
   * City blocks: one building per 16 m lot, with streets between them.
   * Buildings near the path are low so they don't shade it; farther ones are skyscrapers.
   */
  private cityScenery(box: Rect, r: () => number): void {
    const lot = 16, g = this.ground;
    const roofs: MaterialName[] = ['stone', 'red', 'blue', 'white', 'roof'];
    for (let x = box.x0 + 2; x + lot <= box.x1; x += lot) {
      for (let z = box.z0 + 2; z + lot <= box.z1; z += lot) {
        // The street corner of every lot is a spot the cat must never reach.
        if (!this.nearPath(x + 1, z + 1, 3)) this.outside.push([x + 1, z + 1]);
        const w = 8 + r() * 4, d = 8 + r() * 4;
        const b: Rect = { x0: x + (lot - w) / 2, z0: z + (lot - d) / 2, x1: x + (lot + w) / 2, z1: z + (lot + d) / 2 };
        if (this.rectNearPath(b, 3)) continue;
        const near = this.rectNearPath(b, 12);
        const h = near ? 5 + r() * 9 : 14 + r() * 30;
        this.L.box(b.x0, g, b.z0, b.x1, g + h, b.z1, 'building', { round: 0.1 });
        // A flat roof sticking out a little, so its sides never line up with the walls.
        this.L.box(b.x0 - 0.25, g + h, b.z0 - 0.25, b.x1 + 0.25, g + h + 0.5, b.z1 + 0.25, roofs[Math.floor(r() * roofs.length)]);
        if (r() < 0.35) {
          // A water tower on the roof.
          const cx = (b.x0 + b.x1) / 2 + (r() - 0.5) * 3, cz = (b.z0 + b.z1) / 2 + (r() - 0.5) * 3;
          this.L.cylinder(cx, g + h + 0.5, cz, 1.3, 2.6, 'wood');
        }
      }
    }
  }

  /** Moon rocks, boulders, round habitat domes and antennas with red lights. */
  private moonScenery(box: Rect, r: () => number): void {
    const g = this.ground;
    const area = (box.x1 - box.x0) * (box.z1 - box.z0);
    for (let i = 0; i < area / 110; i++) {
      const x = box.x0 + r() * (box.x1 - box.x0), z = box.z0 + r() * (box.z1 - box.z0);
      const roll = r();
      if (this.onHill(x, z, 6)) continue;
      if (roll < 0.4) {
        if (this.nearPath(x, z, 3)) continue;
        this.L.prop('rock', x, g, z, Math.floor(r() * 4) * 90, 1 + r() * 1.8);
      } else if (roll < 0.65) {
        const s = 1.5 + r() * 2.5;
        if (this.nearPath(x, z, 3 + s)) continue;
        // Sunk a little into the ground, so its bottom never lines up with a dome's.
        this.L.box(x - s, g - 0.15, z - s * 0.8, x + s, g + s * (0.6 + r() * 0.6), z + s * 0.8, 'moonrock', { round: 0.6 });
      } else if (roll < 0.85) {
        const rad = 2.5 + r() * 2;
        if (this.nearPath(x, z, 4 + rad)) continue;
        this.L.cylinder(x, g, z, rad, 3, 'panel');
        this.L.cylinder(x, g + 3, z, rad * 0.7, 1.4, 'glass');
      } else {
        if (this.nearPath(x, z, 3)) continue;
        const h = 6 + r() * 6;
        this.L.cylinder(x, g, z, 0.18, h, 'metal');
        this.L.box(x - 1.2, g + h * 0.7, z - 0.1, x + 1.2, g + h * 0.7 + 1.4, z + 0.1, 'panel', { round: 0.05 });
        this.L.cylinder(x, g + h, z, 0.3, 0.4, 'red');
      }
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
