// Collision boxes for each piece. Visual rounding is small, so a rounded box
// collides as a plain box. No Three.js here so it runs in unit tests.

import type { Collider } from './collision';
import { NO_GRIP, SKY_BARRIER_HEIGHT, type LevelFile, type MaterialName, type Piece, type PropName, type Vec3 } from './levelFormat';

/** Prop collision boxes around the base center, before turning and scaling. null = walk through. */
const PROP_BOXES: Record<PropName, { min: Vec3; max: Vec3; grip: boolean } | null> = {
  tree: { min: [-0.32, 0, -0.32], max: [0.32, 3.2, 0.32], grip: true },
  bush: { min: [-0.7, 0, -0.7], max: [0.7, 1.0, 0.7], grip: false },
  rock: { min: [-0.6, 0, -0.6], max: [0.6, 0.7, 0.6], grip: true },
  flowers: null,
};

/** Bushy surfaces are too soft to wall-run, wall-jump or hang from. */
const hasGrip = (mat: MaterialName) => !NO_GRIP.includes(mat);

const box = (pos: Vec3, size: Vec3, blocksCamera: boolean, grip: boolean): Collider => ({
  min: [...pos],
  max: [pos[0] + size[0], pos[1] + size[1], pos[2] + size[2]],
  blocksCamera,
  grip,
});

/** Turns a box around the y axis (90-degree steps), the same way Three.js turns the prop's model. */
export function turnBox(min: Vec3, max: Vec3, degrees: number): { min: Vec3; max: Vec3 } {
  const a = (degrees * Math.PI) / 180;
  const c = Math.round(Math.cos(a)), s = Math.round(Math.sin(a));
  const xs: number[] = [], zs: number[] = [];
  for (const x of [min[0], max[0]]) {
    for (const z of [min[2], max[2]]) {
      xs.push(x * c + z * s);
      zs.push(-x * s + z * c);
    }
  }
  return {
    min: [Math.min(...xs), min[1], Math.min(...zs)],
    max: [Math.max(...xs), max[1], Math.max(...zs)],
  };
}

export function pieceColliders(p: Piece): Collider[] {
  switch (p.kind) {
    case 'box':
      return p.solid === false ? [] : [box(p.pos, p.size, true, hasGrip(p.mat))];
    case 'cylinder': {
      if (p.solid === false) return [];
      const h = p.radius * 0.85;
      return [box([p.pos[0] - h, p.pos[1], p.pos[2] - h], [h * 2, p.height, h * 2], true, hasGrip(p.mat))];
    }
    case 'barrier':
      return [box(p.pos, p.size, false, false)];
    case 'water':
    case 'lava':
      return [];
    case 'prop': {
      const local = PROP_BOXES[p.prop];
      if (!local) return [];
      const s = p.scale ?? 1;
      const scaled = (v: Vec3): Vec3 => [v[0] * s, v[1] * s, v[2] * s];
      const t = turnBox(scaled(local.min), scaled(local.max), p.rot ?? 0);
      return [{
        min: [t.min[0] + p.pos[0], t.min[1] + p.pos[1], t.min[2] + p.pos[2]],
        max: [t.max[0] + p.pos[0], t.max[1] + p.pos[1], t.max[2] + p.pos[2]],
        blocksCamera: true,
        grip: local.grip,
      }];
    }
  }
}

/** All colliders in a level, plus invisible walls around the edge of the play area. */
export function levelColliders(level: LevelFile): Collider[] {
  const out = level.pieces.flatMap(pieceColliders);
  const [sx, , sz] = level.size;
  const t = 4, lo = -50, hi = SKY_BARRIER_HEIGHT + 60;
  out.push(
    box([-t, lo, -t], [t, hi - lo, sz + 2 * t], false, false),
    box([sx, lo, -t], [t, hi - lo, sz + 2 * t], false, false),
    box([0, lo, -t], [sx, hi - lo, t], false, false),
    box([0, lo, sz], [sx, hi - lo, t], false, false),
  );
  return out;
}
