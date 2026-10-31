import { describe, expect, it } from 'vitest';
import { AIR, blockId } from '../src/world/blocks';
import { World } from '../src/world/world';

describe('World', () => {
  it('stores blocks and reads air outside the grid', () => {
    const w = new World(4, 4, 4);
    const stone = blockId('stone')!;
    w.set(1, 2, 3, stone);
    expect(w.get(1, 2, 3)).toBe(stone);
    expect(w.isSolid(1, 2, 3)).toBe(true);
    expect(w.get(-1, 0, 0)).toBe(AIR);
    expect(w.get(0, 4, 0)).toBe(AIR);
    w.set(9, 9, 9, stone); // ignored
    expect(w.cells.filter((b) => b !== AIR).length).toBe(1);
  });

  it('treats water and lava as not solid', () => {
    const w = new World(2, 1, 1);
    w.set(0, 0, 0, blockId('water')!);
    w.set(1, 0, 0, blockId('lava')!);
    expect(w.isSolid(0, 0, 0)).toBe(false);
    expect(w.isSolid(1, 0, 0)).toBe(false);
  });
});
