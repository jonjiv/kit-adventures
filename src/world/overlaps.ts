// Finds places where two different surfaces lie on the same flat plane and
// face the same way. The graphics card can't tell which is in front, so they
// flicker ("z-fighting"). Used by tests to keep levels flicker-free.
// No Three.js here so it runs in unit tests.

import { SEE_THROUGH, type LevelFile, type Piece, type Vec3 } from './levelFormat';

/** Default corner rounding per material (must match materials.ts). */
export type RoundLookup = (mat: string) => number;

interface Face {
  piece: number;
  surface: string;
  axis: 0 | 1 | 2;
  /** +1 or -1: which way the face points. 0 = both ways (see-through, double-sided water). */
  facing: number;
  plane: number;
  /** Flat part of the face in the other two axes: [lo0, hi0, lo1, hi1]. */
  rect: [number, number, number, number];
}

export interface Overlap {
  a: number;
  b: number;
  surfaces: [string, string];
  axis: 'x' | 'y' | 'z';
  plane: number;
  area: number;
  at: Vec3;
}

function boxFaces(i: number, pos: Vec3, size: Vec3, surface: string, round: number, doubleSided: boolean): Face[] {
  const r = Math.max(0, Math.min(round, Math.min(...size) / 2 - 0.001));
  const out: Face[] = [];
  for (const axis of [0, 1, 2] as const) {
    const [u, v] = [0, 1, 2].filter((a) => a !== axis);
    const rect: Face['rect'] = [pos[u] + r, pos[u] + size[u] - r, pos[v] + r, pos[v] + size[v] - r];
    for (const facing of [-1, 1]) {
      out.push({
        piece: i, surface, axis, facing: doubleSided ? 0 : facing,
        plane: facing > 0 ? pos[axis] + size[axis] : pos[axis], rect,
      });
    }
  }
  return out;
}

function pieceFaces(i: number, p: Piece, round: RoundLookup): Face[] {
  switch (p.kind) {
    case 'box':
      return boxFaces(i, p.pos, p.size, p.mat, p.round ?? round(p.mat), false);
    case 'water':
      return boxFaces(i, p.pos, p.size, 'water', 0, true);
    case 'lava':
      return boxFaces(i, p.pos, p.size, 'lava', 0, false);
    case 'cylinder': {
      // Only the flat top and bottom caps can lie on another flat surface; use the square inside the circle.
      const h = p.radius * Math.SQRT1_2;
      const pos: Vec3 = [p.pos[0] - h, p.pos[1], p.pos[2] - h];
      return boxFaces(i, pos, [h * 2, p.height, h * 2], p.mat, 0, false).filter((f) => f.axis === 1);
    }
    default:
      return [];
  }
}

/** Solid, see-nothing-through boxes that can hide faces pressed against them. */
function opaqueBoxes(level: LevelFile): { i: number; min: Vec3; max: Vec3 }[] {
  const out: { i: number; min: Vec3; max: Vec3 }[] = [];
  level.pieces.forEach((p, i) => {
    if (p.kind === 'box' && !SEE_THROUGH.includes(p.mat)) {
      out.push({ i, min: p.pos, max: [p.pos[0] + p.size[0], p.pos[1] + p.size[1], p.pos[2] + p.size[2]] });
    }
  });
  return out;
}

/**
 * Every pair of different surfaces sharing a plane, facing the same way,
 * overlapping by more than minArea, where the overlap can actually be seen
 * (it isn't pressed flat against another solid box).
 */
export function findOverlaps(level: LevelFile, round: RoundLookup, minArea = 0.01): Overlap[] {
  const faces = level.pieces.flatMap((p, i) => pieceFaces(i, p, round));
  const solids = opaqueBoxes(level);
  const hidden = (axis: number, plane: number, facing: number, u: number, v: number, r: number[], skip: number[]) => {
    // Look just in front of the face (both sides if it's double-sided).
    const sides = facing === 0 ? [-1, 1] : [facing];
    return sides.every((side) => {
      const at = plane + side * 0.01;
      return solids.some((s) =>
        !skip.includes(s.i) &&
        s.min[axis] < at && s.max[axis] > at &&
        s.min[u] <= r[0] + 1e-6 && s.max[u] >= r[1] - 1e-6 &&
        s.min[v] <= r[2] + 1e-6 && s.max[v] >= r[3] - 1e-6);
    });
  };
  // Group faces by axis and plane so only faces on the same plane are compared.
  const groups = new Map<string, Face[]>();
  for (const f of faces) {
    const key = `${f.axis}:${f.plane.toFixed(4)}`;
    const g = groups.get(key);
    if (g) g.push(f);
    else groups.set(key, [f]);
  }
  const out: Overlap[] = [];
  for (const group of groups.values()) {
    for (let i = 0; i < group.length; i++) {
      for (let j = i + 1; j < group.length; j++) {
        const a = group[i], b = group[j];
        if (a.piece === b.piece || a.surface === b.surface) continue;
        if (a.facing !== 0 && b.facing !== 0 && a.facing !== b.facing) continue;
        const w = Math.min(a.rect[1], b.rect[1]) - Math.max(a.rect[0], b.rect[0]);
        const h = Math.min(a.rect[3], b.rect[3]) - Math.max(a.rect[2], b.rect[2]);
        if (w <= 0 || h <= 0 || w * h < minArea) continue;
        const [u, v] = [0, 1, 2].filter((n) => n !== a.axis);
        const r = [Math.max(a.rect[0], b.rect[0]), Math.min(a.rect[1], b.rect[1]), Math.max(a.rect[2], b.rect[2]), Math.min(a.rect[3], b.rect[3])];
        const facing = a.facing || b.facing;
        if (hidden(a.axis, a.plane, facing, u, v, r, [a.piece, b.piece])) continue;
        const at: Vec3 = [0, 0, 0];
        at[a.axis] = a.plane;
        at[u] = (Math.max(a.rect[0], b.rect[0]) + Math.min(a.rect[1], b.rect[1])) / 2;
        at[v] = (Math.max(a.rect[2], b.rect[2]) + Math.min(a.rect[3], b.rect[3])) / 2;
        out.push({
          a: a.piece, b: b.piece, surfaces: [a.surface, b.surface],
          axis: (['x', 'y', 'z'] as const)[a.axis], plane: a.plane, area: w * h, at,
        });
      }
    }
  }
  return out;
}
