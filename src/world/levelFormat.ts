// The level file format, shared by the game, the level editor and
// scripts/build-levels.ts. This file must not import anything, so plain Node
// can run the level-building scripts with it.
//
// A level is a list of pieces (rounded boxes, cylinders, props like trees and
// hedges, water and lava pools, and invisible barriers) plus a list of objects
// (start point, and later checkpoints, yarn, portal, enemies).

export const LEVEL_FORMAT_VERSION = 2;

export type Vec3 = [number, number, number];
export type Theme = 'house' | 'backyard' | 'city' | 'moon';
export const THEMES: readonly Theme[] = ['house', 'backyard', 'city', 'moon'];

/** Biggest level the game will load (the editor uses a smaller limit). */
export const MAX_LEVEL_SIZE: Vec3 = [256, 96, 256];

/** Surface materials a box or cylinder can use. */
export const MATERIALS = [
  'grass', 'dirt', 'wood', 'stone', 'brick', 'glass', 'carpet', 'fabric', 'roof',
  'plaster', 'metal', 'leaves', 'bark', 'white', 'red', 'yellow', 'blue', 'pink',
  'asphalt', 'building', 'moondust', 'moonrock', 'panel', 'forcefield', 'mushroom', 'vent',
] as const;
export type MaterialName = (typeof MATERIALS)[number];

/** Surfaces you can see through. */
export const SEE_THROUGH: readonly MaterialName[] = ['glass', 'forcefield'];
/**
 * Soft or slippery surfaces: no wall runs, wall jumps or ledge grabs on them.
 * Path walls use these, so you can't wall-run past an obstacle.
 */
export const NO_GRIP: readonly MaterialName[] = ['leaves', 'glass', 'forcefield', 'mushroom'];
/** Landing on these bounces the cat high into the air (garden mushrooms). */
export const BOUNCY: readonly MaterialName[] = ['mushroom'];

/**
 * Objects that are areas: pos is the low corner and to is the high corner.
 * In an updraft, wind blows the cat upward (city fans). In low gravity the cat
 * falls slowly and jumps much higher and farther (moon bubbles).
 */
export const ZONES = ['updraft', 'lowGravity'] as const;
export type ZoneKind = (typeof ZONES)[number];

/** Props are ready-made decorations built in code (see src/world/props.ts). */
export const PROPS = ['tree', 'bush', 'flowers', 'rock'] as const;
export type PropName = (typeof PROPS)[number];

export type Piece =
  /** Rounded box. pos is the low corner (smallest x, y, z). */
  | { kind: 'box'; pos: Vec3; size: Vec3; mat: MaterialName; round?: number; solid?: boolean }
  /** Upright cylinder. pos is the center of its bottom. */
  | { kind: 'cylinder'; pos: Vec3; radius: number; height: number; mat: MaterialName; solid?: boolean }
  /** Pool of water or lava. pos is the low corner. */
  | { kind: 'water' | 'lava'; pos: Vec3; size: Vec3 }
  /** Invisible wall that only blocks the cat. pos is the low corner. */
  | { kind: 'barrier'; pos: Vec3; size: Vec3 }
  /** Decoration. pos is the center of its base; rot turns it in 90-degree steps. */
  | { kind: 'prop'; prop: PropName; pos: Vec3; rot?: number; scale?: number };

export interface LevelObject {
  type: string;
  /** For the start point: where the cat's feet go. */
  pos: Vec3;
  /** Second point for moving platforms and enemy patrols. */
  to?: Vec3;
  /** Facing direction in degrees (0 = looking toward -Z). */
  yaw?: number;
  /** Words on a sign. */
  text?: string;
}

export interface LevelFile {
  version: number;
  name: string;
  theme: Theme;
  /** Play area [x, y, z] from 0 to size. The cat can't leave it sideways. */
  size: Vec3;
  /** Falling below this height sends the cat back to the last checkpoint. */
  killY?: number;
  pieces: Piece[];
  objects: LevelObject[];
}

const isNum = (v: unknown): v is number => typeof v === 'number' && Number.isFinite(v);
const isVec3 = (v: unknown): v is Vec3 => Array.isArray(v) && v.length === 3 && v.every(isNum);
const isSize = (v: unknown): v is Vec3 => isVec3(v) && v.every((n) => n > 0);

function pieceProblem(p: Record<string, unknown>): string | null {
  if (!isVec3(p.pos)) return 'needs a position';
  switch (p.kind) {
    case 'box':
      if (!isSize(p.size)) return 'needs a size';
      if (!MATERIALS.includes(p.mat as MaterialName)) return `has an unknown material "${String(p.mat)}"`;
      if (p.round !== undefined && !(isNum(p.round) && p.round >= 0)) return 'has a broken roundness';
      return null;
    case 'cylinder':
      if (!isNum(p.radius) || p.radius <= 0 || !isNum(p.height) || p.height <= 0) return 'needs a radius and height';
      if (!MATERIALS.includes(p.mat as MaterialName)) return `has an unknown material "${String(p.mat)}"`;
      return null;
    case 'water':
    case 'lava':
    case 'barrier':
      return isSize(p.size) ? null : 'needs a size';
    case 'prop':
      if (!PROPS.includes(p.prop as PropName)) return `is an unknown prop "${String(p.prop)}"`;
      if (p.rot !== undefined && !(isNum(p.rot) && p.rot % 90 === 0)) return 'can only turn in 90-degree steps';
      if (p.scale !== undefined && !(isNum(p.scale) && p.scale > 0)) return 'has a broken scale';
      return null;
    default:
      return `is an unknown kind "${String(p.kind)}"`;
  }
}

/** Returns a list of problems. An empty list means the level is fine to load. */
export function validateLevel(data: unknown): string[] {
  const errors: string[] = [];
  if (typeof data !== 'object' || data === null) return ['The level file is not a level.'];
  const d = data as Record<string, unknown>;

  if (d.version !== LEVEL_FORMAT_VERSION) errors.push(`Unknown level version: ${String(d.version)}.`);
  if (typeof d.name !== 'string') errors.push('The level needs a name.');
  if (!THEMES.includes(d.theme as Theme)) errors.push(`Unknown theme: ${String(d.theme)}.`);
  if (!(isSize(d.size) && d.size.every((n, i) => n <= MAX_LEVEL_SIZE[i]))) {
    errors.push('The level size is missing or too big.');
  }
  if (d.killY !== undefined && !isNum(d.killY)) errors.push('The fall height is broken.');

  if (!Array.isArray(d.pieces)) {
    errors.push('The level needs a pieces list.');
  } else {
    d.pieces.forEach((p, i) => {
      const problem = typeof p === 'object' && p !== null ? pieceProblem(p as Record<string, unknown>) : 'is broken';
      if (problem) errors.push(`Piece ${i + 1} ${problem}.`);
    });
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
      } else if (ZONES.includes(obj.type as ZoneKind) && obj.to === undefined) {
        errors.push(`Object ${i + 1} is an area and needs a "to" corner.`);
      } else if (obj.text !== undefined && typeof obj.text !== 'string') {
        errors.push(`Object ${i + 1} has broken sign words.`);
      }
    });
  }
  return errors;
}

/** How high the invisible walls on top of level walls reach, so wall jumps can't escape. */
export const SKY_BARRIER_HEIGHT = 60;

/** Helper for building levels in code. Corners can be given in any order. */
export class LevelBuilder {
  size: Vec3;
  killY: number | undefined;
  readonly pieces: Piece[] = [];
  readonly objects: LevelObject[] = [];

  constructor(size: Vec3) {
    this.size = size;
  }

  /**
   * Moves everything so the lowest x and z sit at `margin`, and sets the level
   * size to fit (with the same margin on the far side). Barriers count for height.
   */
  fitToContent(margin: number): void {
    let minX = Infinity, minZ = Infinity, maxX = -Infinity, maxY = 0, maxZ = -Infinity;
    const grow = (x0: number, z0: number, x1: number, y1: number, z1: number) => {
      minX = Math.min(minX, x0); minZ = Math.min(minZ, z0);
      maxX = Math.max(maxX, x1); maxY = Math.max(maxY, y1); maxZ = Math.max(maxZ, z1);
    };
    for (const p of this.pieces) {
      if (p.kind === 'cylinder') grow(p.pos[0] - p.radius, p.pos[2] - p.radius, p.pos[0] + p.radius, p.pos[1] + p.height, p.pos[2] + p.radius);
      else if (p.kind === 'prop') grow(p.pos[0], p.pos[2], p.pos[0], p.pos[1], p.pos[2]);
      else grow(p.pos[0], p.pos[2], p.pos[0] + p.size[0], p.pos[1] + p.size[1], p.pos[2] + p.size[2]);
    }
    const dx = margin - minX, dz = margin - minZ;
    for (const p of this.pieces) { p.pos[0] += dx; p.pos[2] += dz; }
    for (const o of this.objects) {
      o.pos[0] += dx; o.pos[2] += dz;
      if (o.to) { o.to[0] += dx; o.to[2] += dz; }
    }
    this.size = [Math.ceil(maxX - minX + margin * 2), Math.ceil(maxY + 1), Math.ceil(maxZ - minZ + margin * 2)];
  }

  private static span(x0: number, y0: number, z0: number, x1: number, y1: number, z1: number) {
    const pos: Vec3 = [Math.min(x0, x1), Math.min(y0, y1), Math.min(z0, z1)];
    const size: Vec3 = [Math.abs(x1 - x0), Math.abs(y1 - y0), Math.abs(z1 - z0)];
    return { pos, size };
  }

  /** Rounded box between two corners. */
  box(
    x0: number, y0: number, z0: number, x1: number, y1: number, z1: number,
    mat: MaterialName, opts: { round?: number; solid?: boolean } = {},
  ): void {
    this.pieces.push({ kind: 'box', ...LevelBuilder.span(x0, y0, z0, x1, y1, z1), mat, ...opts });
  }

  cylinder(x: number, y: number, z: number, radius: number, height: number, mat: MaterialName): void {
    this.pieces.push({ kind: 'cylinder', pos: [x, y, z], radius, height, mat });
  }

  water(x0: number, y0: number, z0: number, x1: number, y1: number, z1: number): void {
    this.pieces.push({ kind: 'water', ...LevelBuilder.span(x0, y0, z0, x1, y1, z1) });
  }

  lava(x0: number, y0: number, z0: number, x1: number, y1: number, z1: number): void {
    this.pieces.push({ kind: 'lava', ...LevelBuilder.span(x0, y0, z0, x1, y1, z1) });
  }

  barrier(x0: number, y0: number, z0: number, x1: number, y1: number, z1: number): void {
    this.pieces.push({ kind: 'barrier', ...LevelBuilder.span(x0, y0, z0, x1, y1, z1) });
  }

  /**
   * A wall the cat must never get past: a visible box plus an invisible
   * barrier on top of it reaching up to the sky.
   */
  wall(
    x0: number, y0: number, z0: number, x1: number, y1: number, z1: number,
    mat: MaterialName, opts: { round?: number } = {},
  ): void {
    this.box(x0, y0, z0, x1, y1, z1, mat, opts);
    this.barrier(x0, Math.max(y0, y1), z0, x1, SKY_BARRIER_HEIGHT, z1);
  }

  prop(prop: PropName, x: number, y: number, z: number, rot = 0, scale?: number): void {
    this.pieces.push({ kind: 'prop', prop, pos: [x, y, z], ...(rot ? { rot } : {}), ...(scale ? { scale } : {}) });
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
      ...(this.killY !== undefined ? { killY: this.killY } : {}),
      pieces: this.pieces.map((p) => structuredClone(p)),
      objects: this.objects.map((o) => structuredClone(o)),
    };
  }
}
