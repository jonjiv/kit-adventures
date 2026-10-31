import { describe, expect, it } from 'vitest';
import { LevelBuilder } from '../src/world/levelFormat';
import { findOverlaps } from '../src/world/overlaps';

const noRound = () => 0;
const level = (build: (L: LevelBuilder) => void) => {
  const L = new LevelBuilder([20, 20, 20]);
  build(L);
  return L.toLevel('t', 'house');
};

describe('findOverlaps', () => {
  it('finds two different surfaces on the same plane facing the same way', () => {
    // A grass slab stretched down over a dirt box: their sides line up.
    const found = findOverlaps(level((L) => {
      L.box(0, 0, 0, 4, 3, 4, 'dirt');
      L.box(0, 0, 0, 4, 4, 4, 'grass');
    }), noRound);
    expect(found.length).toBeGreaterThan(0);
    expect(found[0].surfaces.sort()).toEqual(['dirt', 'grass']);
  });

  it('ignores boxes that are only stacked or touching back to back', () => {
    expect(findOverlaps(level((L) => {
      L.box(0, 0, 0, 4, 3, 4, 'dirt');
      L.box(0, 3, 0, 4, 3.4, 4, 'grass'); // stacked on top
      L.box(4, 0, 0, 6, 3, 4, 'brick'); // side by side
    }), noRound)).toEqual([]);
  });

  it('ignores the same surface overlapping itself (it looks identical)', () => {
    expect(findOverlaps(level((L) => {
      L.box(0, 0, 0, 4, 3, 4, 'leaves');
      L.box(2, 0, 0, 6, 3, 4, 'leaves');
    }), noRound)).toEqual([]);
  });

  it('ignores faces pressed flat against another solid box', () => {
    // Two bottoms sitting on a slab can never be seen.
    expect(findOverlaps(level((L) => {
      L.box(-1, -1, -1, 7, 0, 7, 'stone');
      L.box(0, 0, 0, 4, 3, 4, 'dirt');
      L.box(2, 0, 0, 6, 2, 4, 'brick');
    }), noRound).filter((o) => o.axis === 'y')).toEqual([]);
  });

  it('treats water as see-through from both sides', () => {
    const found = findOverlaps(level((L) => {
      L.box(0, 0, 0, 1, 3, 4, 'stone');
      L.water(1, 0, 0, 4, 1, 4); // touching the stone's side
    }), noRound);
    expect(found.some((o) => o.surfaces.includes('water') && o.axis === 'x')).toBe(true);
  });
});
