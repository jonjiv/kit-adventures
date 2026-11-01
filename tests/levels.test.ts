import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import { cityLevel, gardenLevel, gymLevel, moonLevel } from '../scripts/build-levels';
import type { PathBuilder } from '../scripts/pathBuilder';
import type { CollisionWorld } from '../src/world/collision';
import { levelFromJson } from '../src/world/level';
import { NO_GRIP, SKY_BARRIER_HEIGHT, validateLevel, type LevelFile } from '../src/world/levelFormat';
import { surfaceRound, type SurfaceName } from '../src/world/materials';
import { findOverlaps } from '../src/world/overlaps';

/** True if something solid fills the whole column from the pit bottoms up to the sky. */
function walledColumn(world: CollisionWorld, x: number, z: number): boolean {
  const hits = world.overlapping([x - 0.05, 1, z - 0.05], [x + 0.05, SKY_BARRIER_HEIGHT - 1, z + 0.05])
    .sort((a, b) => a.min[1] - b.min[1]);
  let covered = 1;
  for (const c of hits) {
    if (c.min[1] > covered + 1e-6) return false;
    covered = Math.max(covered, c.max[1]);
  }
  return covered >= SKY_BARRIER_HEIGHT - 1;
}

/** Every 1 m cell the cat could wander to from the start, ignoring heights, stopping only at full-height walls. */
function reachable(file: LevelFile, world: CollisionWorld, start: [number, number]): Set<string> {
  const seen = new Set<string>();
  const queue: [number, number][] = [[Math.floor(start[0]), Math.floor(start[1])]];
  seen.add(queue[0].join(','));
  while (queue.length) {
    const [cx, cz] = queue.pop()!;
    for (const [dx, dz] of [[1, 0], [-1, 0], [0, 1], [0, -1]]) {
      const nx = cx + dx, nz = cz + dz, key = `${nx},${nz}`;
      if (seen.has(key) || nx < 0 || nz < 0 || nx >= file.size[0] || nz >= file.size[2]) continue;
      if (walledColumn(world, nx + 0.5, nz + 0.5)) continue;
      seen.add(key);
      queue.push([nx, nz]);
    }
  }
  return seen;
}

const LEVELS: [string, string, () => { file: LevelFile; builder: PathBuilder }][] = [
  ['Garden Path', 'garden.json', gardenLevel],
  ['Parkour Gym', 'gym.json', gymLevel],
  ['City Rooftops', 'city.json', cityLevel],
  ['Moon Base', 'moon.json', moonLevel],
];

describe.each(LEVELS)('%s', (_name, json, make) => {
  const { file, builder } = make();
  const level = levelFromJson(file);
  const world = level.collision;
  const standsOnGround = (pos: number[]) =>
    world.groundBelow(pos[0], pos[2], pos[1], 0.3) === pos[1] &&
    world.overlapping([pos[0] - 0.3, pos[1], pos[2] - 0.3], [pos[0] + 0.3, pos[1] + 0.8, pos[2] + 0.3]).length === 0;

  it('is valid and matches the saved JSON (run "npm run levels" if this fails)', () => {
    expect(validateLevel(file)).toEqual([]);
    const saved = JSON.parse(readFileSync(new URL(`../public/levels/${json}`, import.meta.url), 'utf8'));
    expect(saved).toEqual(JSON.parse(JSON.stringify(file)));
  });

  it('starts the cat, and puts every checkpoint, on solid ground with room to stand', () => {
    expect(standsOnGround(level.start.pos)).toBe(true);
    const checkpoints = file.objects.filter((o) => o.type === 'checkpoint');
    expect(checkpoints.length).toBeGreaterThanOrEqual(5);
    for (const c of checkpoints) expect(standsOnGround(c.pos), `checkpoint at ${c.pos.join(',')}`).toBe(true);
  });

  it('has no two different surfaces on the same plane (they would flicker)', () => {
    const found = findOverlaps(file, (m) => surfaceRound(m as SurfaceName));
    const report = found.slice(0, 10).map((o) =>
      `${o.surfaces.join(' + ')} on the ${o.axis} = ${o.plane.toFixed(2)} plane near ${o.at.map((v) => v.toFixed(1)).join(', ')}` +
      ` (pieces ${o.a} and ${o.b}, ${o.area.toFixed(1)} m²)`);
    expect(report).toEqual([]);
  });

  it('has no gaps in its walls: the scenery outside can never be reached', () => {
    const seen = reachable(file, world, [level.start.pos[0], level.start.pos[2]]);
    expect(seen.has(`${Math.floor(builder.goal[0])},${Math.floor(builder.goal[2])}`)).toBe(true);
    expect(builder.outside.length).toBeGreaterThan(20);
    const leaks = builder.outside.filter(([x, z]) => seen.has(`${Math.floor(x)},${Math.floor(z)}`));
    expect(leaks).toEqual([]);
  });

  it('(the wall check does find leaks: without the invisible barriers, the outside is reachable)', () => {
    const leaky = levelFromJson({ ...file, pieces: file.pieces.filter((p) => p.kind !== 'barrier') });
    const seen = reachable(file, leaky.collision, [level.start.pos[0], level.start.pos[2]]);
    expect(builder.outside.some(([x, z]) => seen.has(`${Math.floor(x)},${Math.floor(z)}`))).toBe(true);
  });
});

describe('the walls along every path have no grip, so they cannot be wall-run past an obstacle', () => {
  it.each(LEVELS)('%s', (_name, _json, make) => {
    const { builder } = make();
    expect(NO_GRIP).toContain(builder.style.side);
    expect(NO_GRIP).toContain(builder.mat('leaves'));
  });
});

describe('the themed levels are laid out differently, each with its own obstacle', () => {
  const themed = [
    ['Garden Path', gardenLevel, ['mushroomCliff', 'mushroomPit', 'mushroomPitCliff']],
    ['City Rooftops', cityLevel, ['fanLift', 'fanGlide', 'fanGlideLift']],
    ['Moon Base', moonLevel, ['floatyCliff', 'craterLeap', 'craterCliff']],
  ] as const;
  const plans = themed.map(([, make]) => make().builder.plan);

  it.each(themed.map((t, i) => [t[0], t[2], plans[i]] as const))('%s has its own obstacle in every part of the level', (_name, own, plan) => {
    for (const id of own) expect(plan).toContain(id);
    const others = themed.flatMap((t) => t[2]).filter((id) => !(own as readonly string[]).includes(id));
    for (const id of others) expect(plan).not.toContain(id);
  });

  it('no two levels have the same order of obstacles or turns', () => {
    const strip = (plan: string[]) => plan.filter((p) => p !== 'hill' && p !== 'down');
    for (let i = 0; i < plans.length; i++) {
      for (let j = i + 1; j < plans.length; j++) {
        const a = strip(plans[i]), b = strip(plans[j]);
        const same = a.filter((step, k) => step === b[k]).length;
        expect(same / Math.max(a.length, b.length)).toBeLessThan(0.35);
      }
    }
  });

  it('the Garden and the Moon are hilly', () => {
    expect(plans[0].filter((p) => p === 'hill').length).toBeGreaterThanOrEqual(4);
    expect(plans[2].filter((p) => p === 'hill').length).toBeGreaterThanOrEqual(4);
  });
});

describe('Garden Path', () => {
  it('turns at least five times and is far longer than the old test level', () => {
    const { file } = gardenLevel();
    expect(file.objects.filter((o) => o.type === 'checkpoint')).toHaveLength(5);
    expect(file.pieces.length).toBeGreaterThan(400);
  });
});
