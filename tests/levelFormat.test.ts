import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import { cellIndex, decodeRle, encodeRle, GridBuilder, validateLevel } from '../src/world/levelFormat';
import { levelFromJson } from '../src/world/level';
import { blockId } from '../src/world/blocks';

describe('run-length encoding', () => {
  it('round-trips cells', () => {
    const cells = Uint8Array.from([0, 0, 0, 3, 3, 1, 0, 0, 2]);
    const rle = encodeRle(cells);
    expect(rle).toEqual([0, 3, 3, 2, 1, 1, 0, 2, 2, 1]);
    expect(Array.from(decodeRle(rle, cells.length))).toEqual(Array.from(cells));
  });

  it('rejects the wrong number of cells', () => {
    expect(() => decodeRle([1, 5], 4)).toThrow();
    expect(() => decodeRle([1, 3], 4)).toThrow();
  });
});

describe('GridBuilder', () => {
  it('fills boxes in either corner order and builds a palette', () => {
    const g = new GridBuilder([4, 3, 4]);
    g.fill(2, 0, 2, 0, 0, 0, 'stone');
    g.set(1, 2, 1, 'grass');
    g.set(9, 9, 9, 'grass'); // out of bounds is ignored
    expect(g.palette).toEqual(['air', 'stone', 'grass']);
    expect(g.cells[cellIndex(g.size, 0, 0, 0)]).toBe(1);
    expect(g.cells[cellIndex(g.size, 2, 0, 2)]).toBe(1);
    expect(g.cells[cellIndex(g.size, 3, 0, 3)]).toBe(0);
    expect(g.cells[cellIndex(g.size, 1, 2, 1)]).toBe(2);
    expect(validateLevel(g.toLevel('Tiny', 'house'))).toEqual([]);
  });
});

describe('validateLevel', () => {
  const good = () => new GridBuilder([2, 2, 2]).toLevel('Ok', 'city');

  it('accepts a good level', () => {
    expect(validateLevel(good())).toEqual([]);
  });

  it('finds problems', () => {
    expect(validateLevel(null)).not.toEqual([]);
    expect(validateLevel({ ...good(), theme: 'moon' })).not.toEqual([]);
    expect(validateLevel({ ...good(), size: [0, 2, 2] })).not.toEqual([]);
    expect(validateLevel({ ...good(), size: [999, 2, 2] })).not.toEqual([]);
    expect(validateLevel({ ...good(), palette: ['stone'] })).not.toEqual([]);
    expect(validateLevel({ ...good(), blocks: [0, 7] })).not.toEqual([]);
    expect(validateLevel({ ...good(), blocks: [5, 8] })).not.toEqual([]);
    expect(validateLevel({ ...good(), objects: [{ type: 'start' }] })).not.toEqual([]);
  });
});

describe('levelFromJson', () => {
  it('maps palette names to block ids', () => {
    const g = new GridBuilder([2, 1, 1]);
    g.set(0, 0, 0, 'brick');
    g.set(1, 0, 0, 'not-a-block');
    g.add({ type: 'start', pos: [0, 1, 0] });
    const level = levelFromJson(g.toLevel('Mapped', 'house'));
    expect(level.world.get(0, 0, 0)).toBe(blockId('brick'));
    expect(level.world.get(1, 0, 0)).toBe(0);
    expect(level.start?.pos).toEqual([0, 1, 0]);
  });

  it('throws a friendly error for a broken level', () => {
    expect(() => levelFromJson({})).toThrow();
  });
});

describe('built-in level files', () => {
  it('test.json loads with one start point standing on solid ground', () => {
    const data = JSON.parse(readFileSync(new URL('../public/levels/test.json', import.meta.url), 'utf8'));
    expect(validateLevel(data)).toEqual([]);
    const level = levelFromJson(data);
    expect(level.objects.filter((o) => o.type === 'start')).toHaveLength(1);
    const [x, y, z] = level.start!.pos;
    expect(level.world.isSolid(x, y - 1, z)).toBe(true);
    expect(level.world.isSolid(x, y, z)).toBe(false);
  });
});
