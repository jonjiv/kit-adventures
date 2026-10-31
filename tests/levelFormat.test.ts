import { describe, expect, it } from 'vitest';
import { levelColliders, turnBox } from '../src/world/colliders';
import { levelFromJson } from '../src/world/level';
import { LevelBuilder, SKY_BARRIER_HEIGHT, validateLevel } from '../src/world/levelFormat';

const tiny = () => {
  const L = new LevelBuilder([10, 10, 10]);
  L.box(0, 0, 0, 10, 1, 10, 'grass');
  L.add({ type: 'start', pos: [5, 1, 5] });
  return L;
};

describe('LevelBuilder', () => {
  it('accepts corners in any order', () => {
    const L = new LevelBuilder([10, 10, 10]);
    L.box(4, 3, 2, 1, 0, 0, 'stone');
    expect(L.pieces[0]).toMatchObject({ kind: 'box', pos: [1, 0, 0], size: [3, 3, 2] });
  });

  it('puts a sky-high barrier on top of walls', () => {
    const L = new LevelBuilder([10, 10, 10]);
    L.wall(0, 0, 0, 1, 3, 10, 'brick');
    expect(L.pieces[1]).toMatchObject({ kind: 'barrier', pos: [0, 3, 0], size: [1, SKY_BARRIER_HEIGHT - 3, 10] });
  });

  it('makes valid levels', () => {
    expect(validateLevel(tiny().toLevel('Tiny', 'house'))).toEqual([]);
  });
});

describe('validateLevel', () => {
  const good = () => tiny().toLevel('Ok', 'city');

  it('finds problems', () => {
    expect(validateLevel(null)).not.toEqual([]);
    expect(validateLevel({ ...good(), version: 1 })).not.toEqual([]);
    expect(validateLevel({ ...good(), theme: 'moon' })).not.toEqual([]);
    expect(validateLevel({ ...good(), size: [0, 2, 2] })).not.toEqual([]);
    expect(validateLevel({ ...good(), size: [999, 2, 2] })).not.toEqual([]);
    expect(validateLevel({ ...good(), pieces: [{ kind: 'box', pos: [0, 0, 0], size: [1, 1, 1], mat: 'cheese' }] })).not.toEqual([]);
    expect(validateLevel({ ...good(), pieces: [{ kind: 'prop', prop: 'tree', pos: [0, 0, 0], rot: 45 }] })).not.toEqual([]);
    expect(validateLevel({ ...good(), pieces: [{ kind: 'spaceship', pos: [0, 0, 0] }] })).not.toEqual([]);
    expect(validateLevel({ ...good(), objects: [{ type: 'start' }] })).not.toEqual([]);
  });
});

describe('levelFromJson', () => {
  it('needs a start point', () => {
    const L = new LevelBuilder([10, 10, 10]);
    expect(() => levelFromJson(L.toLevel('No start', 'house'))).toThrow(/start/);
  });

  it('throws a friendly error for a broken level', () => {
    expect(() => levelFromJson({})).toThrow();
  });
});

describe('colliders', () => {
  it('turns prop boxes the same way the model turns', () => {
    const t = turnBox([0, 0, 0], [2, 1, 1], 90);
    // A box sticking out toward +X sticks out toward -Z after a quarter turn.
    expect(t.min).toEqual([0, 0, -2]);
    expect(t.max).toEqual([1, 1, 0]);
  });

  it('adds invisible walls around the play area that do not block the camera', () => {
    const colliders = levelColliders(tiny().toLevel('Tiny', 'house'));
    const walls = colliders.filter((c) => !c.blocksCamera);
    expect(walls).toHaveLength(4);
    expect(colliders.filter((c) => c.blocksCamera)).toHaveLength(1);
  });

  it('skips non-solid pieces, water and lava', () => {
    const L = new LevelBuilder([10, 10, 10]);
    L.box(0, 0, 0, 1, 1, 1, 'glass', { solid: false });
    L.water(0, 0, 0, 2, 1, 2);
    L.lava(0, 0, 0, 2, 1, 2);
    L.prop('flowers', 5, 0, 5);
    expect(levelColliders(L.toLevel('x', 'house')).filter((c) => c.blocksCamera)).toHaveLength(0);
  });
});
