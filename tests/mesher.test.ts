import { describe, expect, it } from 'vitest';
import { blockId } from '../src/world/blocks';
import { LIQUID_SURFACE, meshChunk } from '../src/world/mesher';
import { World } from '../src/world/world';

const faces = (indices: number[]) => indices.length / 6;
const stone = blockId('stone')!;
const glass = blockId('glass')!;
const water = blockId('water')!;

describe('meshChunk', () => {
  it('draws all 6 faces of a lone block', () => {
    const w = new World(3, 3, 3);
    w.set(1, 1, 1, stone);
    const m = meshChunk(w, 0, 0, 0, 16);
    expect(faces(m.opaque.indices)).toBe(6);
    expect(m.opaque.positions.length).toBe(6 * 4 * 3);
  });

  it('hides faces between two touching blocks', () => {
    const w = new World(3, 3, 3);
    w.set(0, 0, 0, stone);
    w.set(1, 0, 0, stone);
    expect(faces(meshChunk(w, 0, 0, 0, 16).opaque.indices)).toBe(10);
  });

  it('keeps stone faces behind glass but drops glass faces against stone', () => {
    const w = new World(3, 3, 3);
    w.set(0, 0, 0, stone);
    w.set(1, 0, 0, glass);
    const m = meshChunk(w, 0, 0, 0, 16);
    expect(faces(m.opaque.indices)).toBe(6);
    expect(faces(m.cutout.indices)).toBe(5);
  });

  it('has no faces between water blocks and lowers the surface', () => {
    const w = new World(3, 3, 3);
    w.set(0, 0, 0, water);
    w.set(1, 0, 0, water);
    const m = meshChunk(w, 0, 0, 0, 16);
    expect(faces(m.water.indices)).toBe(10);
    const ys = m.water.positions.filter((_, i) => i % 3 === 1);
    expect(Math.max(...ys)).toBeCloseTo(LIQUID_SURFACE);
  });

  it('makes triangles that face outward', () => {
    const w = new World(3, 3, 3);
    w.set(1, 1, 1, stone);
    const { positions: p, normals: n, indices } = meshChunk(w, 0, 0, 0, 16).opaque;
    const vert = (i: number) => [p[i * 3], p[i * 3 + 1], p[i * 3 + 2]];
    for (let t = 0; t < indices.length; t += 3) {
      const [a, b, c] = [indices[t], indices[t + 1], indices[t + 2]].map(vert);
      const e1 = b.map((v, i) => v - a[i]);
      const e2 = c.map((v, i) => v - a[i]);
      const cross = [e1[1] * e2[2] - e1[2] * e2[1], e1[2] * e2[0] - e1[0] * e2[2], e1[0] * e2[1] - e1[1] * e2[0]];
      const ni = indices[t] * 3;
      expect(cross[0] * n[ni] + cross[1] * n[ni + 1] + cross[2] * n[ni + 2]).toBeGreaterThan(0);
    }
  });

  it('darkens corners tucked next to other blocks', () => {
    const w = new World(3, 3, 3);
    w.set(0, 0, 0, stone);
    w.set(1, 1, 0, stone); // sits diagonally above, shading the top of the first block
    const colors = meshChunk(w, 0, 0, 0, 1).opaque.colors;
    expect(Math.min(...colors)).toBeLessThan(1);
  });
});
