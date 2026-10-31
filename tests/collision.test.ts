import { describe, expect, it } from 'vitest';
import { CollisionWorld, type Collider } from '../src/world/collision';

const c = (min: [number, number, number], max: [number, number, number], blocksCamera = true): Collider => ({ min, max, blocksCamera });

describe('CollisionWorld', () => {
  const world = new CollisionWorld([
    c([0, -1, 0], [20, 0, 20]), // floor
    c([10, 0, 0], [11, 3, 20]), // wall
    c([0, 0, 15], [20, 50, 16], false), // invisible barrier
  ]);

  it('finds overlapping boxes but not ones just touching', () => {
    expect(world.overlapping([1, 0, 1], [2, 1, 2])).toHaveLength(0);
    expect(world.overlapping([1, -0.1, 1], [2, 1, 2])).toHaveLength(1);
    expect(world.overlapping([9.5, 0, 1], [10.5, 1, 2])).toHaveLength(1);
  });

  it('finds the same box only once even when it spans many grid cells', () => {
    expect(world.overlapping([0, -0.5, 0], [20, 0.5, 20])).toHaveLength(3);
  });

  it('casts camera rays against walls, ignoring invisible barriers', () => {
    expect(world.raycastCamera([5, 1, 5], [1, 0, 0], 10, 0)).toBeCloseTo(5);
    expect(world.raycastCamera([5, 1, 5], [1, 0, 0], 10, 0.5)).toBeCloseTo(4.5);
    expect(world.raycastCamera([5, 1, 5], [0, 0, 1], 20, 0)).toBe(20);
    expect(world.raycastCamera([5, 1, 5], [-1, 0, 0], 3, 0)).toBe(3);
  });

  it('finds the ground under a point', () => {
    expect(world.groundBelow(5, 5, 2, 0.2)).toBe(0);
    expect(world.groundBelow(10.5, 5, 5, 0.2)).toBe(3);
    expect(world.groundBelow(50, 50, 5, 0.2)).toBeNull();
  });
});
