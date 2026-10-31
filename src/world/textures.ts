// Draws the blocky 16x16 texture atlas with code, so there are no image files.

import * as THREE from 'three';
import { ATLAS_COLS, ATLAS_ROWS, ATLAS_TILE, Tile } from './blocks';

const T = ATLAS_TILE;

function mulberry32(seed: number) {
  return () => {
    seed |= 0;
    seed = (seed + 0x6d2b79f5) | 0;
    let t = Math.imul(seed ^ (seed >>> 15), 1 | seed);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

type RGB = [number, number, number];
const hex = (h: number): RGB => [(h >> 16) & 255, (h >> 8) & 255, h & 255];

class TilePainter {
  private img: ImageData;
  private rand: () => number;
  constructor(img: ImageData, seed: number) {
    this.img = img;
    this.rand = mulberry32(seed);
  }
  r() {
    return this.rand();
  }
  px(x: number, y: number, c: RGB, alpha = 255, jitter = 0) {
    const j = jitter ? (this.rand() * 2 - 1) * jitter : 0;
    const i = (y * T + x) * 4;
    const d = this.img.data;
    d[i] = Math.max(0, Math.min(255, c[0] + j));
    d[i + 1] = Math.max(0, Math.min(255, c[1] + j));
    d[i + 2] = Math.max(0, Math.min(255, c[2] + j));
    d[i + 3] = alpha;
  }
  noise(c: RGB, jitter: number) {
    for (let y = 0; y < T; y++) for (let x = 0; x < T; x++) this.px(x, y, c, 255, jitter);
  }
  specks(c: RGB, count: number, jitter = 10) {
    for (let n = 0; n < count; n++) this.px(Math.floor(this.r() * T), Math.floor(this.r() * T), c, 255, jitter);
  }
}

const painters: Record<number, (p: TilePainter) => void> = {
  [Tile.GrassTop]: (p) => {
    p.noise(hex(0x5cc84a), 22);
    p.specks(hex(0x7fe06a), 18);
  },
  [Tile.GrassSide]: (p) => {
    p.noise(hex(0x9a6a3e), 18);
    p.specks(hex(0x7a5030), 14);
    for (let x = 0; x < T; x++) {
      const depth = 3 + Math.floor(p.r() * 3);
      for (let y = 0; y < depth; y++) p.px(x, y, hex(0x5cc84a), 255, 18);
    }
  },
  [Tile.Dirt]: (p) => {
    p.noise(hex(0x9a6a3e), 18);
    p.specks(hex(0x7a5030), 20);
    p.specks(hex(0xb88a5a), 8);
  },
  [Tile.Wood]: (p) => {
    p.noise(hex(0xc8924e), 10);
    for (let y = 0; y < T; y++) {
      if (y % 4 === 3) for (let x = 0; x < T; x++) p.px(x, y, hex(0x8a5a2c), 255, 6);
    }
    for (let row = 0; row < 4; row++) {
      const seam = (row * 7 + 3) % T;
      for (let y = row * 4; y < row * 4 + 3; y++) p.px(seam, y, hex(0x8a5a2c), 255, 6);
    }
  },
  [Tile.Stone]: (p) => {
    p.noise(hex(0x9a9ea6), 14);
    for (let n = 0; n < 6; n++) {
      const cx = Math.floor(p.r() * T), cy = Math.floor(p.r() * T);
      p.px(cx, cy, hex(0x7a7e86), 255, 6);
      p.px((cx + 1) % T, cy, hex(0x7a7e86), 255, 6);
    }
  },
  [Tile.Brick]: (p) => {
    p.noise(hex(0xd0d0c8), 6);
    for (let row = 0; row < 4; row++) {
      const offset = row % 2 ? 4 : 0;
      for (let y = row * 4; y < row * 4 + 3; y++) {
        for (let x = 0; x < T; x++) {
          if ((x + offset) % 8 === 7) continue;
          p.px(x, y, hex(0xc4553c), 255, 14);
        }
      }
    }
  },
  [Tile.Glass]: (p) => {
    for (let y = 0; y < T; y++) for (let x = 0; x < T; x++) p.px(x, y, hex(0xcdeeff), 0);
    for (let i = 0; i < T; i++) {
      for (const [x, y] of [[i, 0], [i, T - 1], [0, i], [T - 1, i]]) p.px(x, y, hex(0xe8f8ff), 255, 8);
    }
    for (let i = 0; i < 4; i++) p.px(4 + i, 7 - i, hex(0xffffff), 255);
    for (let i = 0; i < 2; i++) p.px(9 + i, 5 - i, hex(0xffffff), 255);
  },
  [Tile.Carpet]: (p) => {
    p.noise(hex(0x8a5cd6), 10);
    for (let y = 1; y < T; y += 4) for (let x = 1 + ((y >> 2) % 2) * 2; x < T; x += 4) p.px(x, y, hex(0xb898f0), 255, 6);
  },
  [Tile.Roof]: (p) => {
    p.noise(hex(0xc8603a), 12);
    for (let row = 0; row < 4; row++) {
      const y = row * 4 + 3;
      for (let x = 0; x < T; x++) p.px(x, y, hex(0x8a3a22), 255, 8);
      const offset = row % 2 ? 2 : 0;
      for (let x = offset; x < T; x += 4) p.px(x, y - 1, hex(0x9a4428), 255, 8);
    }
  },
  [Tile.Water]: (p) => {
    p.noise(hex(0x3c8cf0), 12);
    for (let n = 0; n < 5; n++) {
      const y = Math.floor(p.r() * T), x0 = Math.floor(p.r() * T);
      for (let i = 0; i < 4; i++) p.px((x0 + i) % T, y, hex(0x8cc8ff), 255, 6);
    }
  },
  [Tile.Lava]: (p) => {
    p.noise(hex(0xff7a1a), 20);
    for (let n = 0; n < 10; n++) {
      const cx = Math.floor(p.r() * T), cy = Math.floor(p.r() * T);
      p.px(cx, cy, hex(0xffd23a), 255, 10);
      p.px((cx + 1) % T, cy, hex(0xffd23a), 255, 10);
      p.px(cx, (cy + 1) % T, hex(0xffb02a), 255, 10);
    }
  },
  [Tile.Leaves]: (p) => {
    p.noise(hex(0x3e9e3a), 26);
    p.specks(hex(0x2a7028), 30, 8);
    p.specks(hex(0x6cc85a), 10, 8);
  },
};

export function createAtlasCanvas(): HTMLCanvasElement {
  const canvas = document.createElement('canvas');
  canvas.width = ATLAS_COLS * T;
  canvas.height = ATLAS_ROWS * T;
  const ctx = canvas.getContext('2d')!;
  for (const [tile, paint] of Object.entries(painters)) {
    const t = Number(tile);
    const img = ctx.createImageData(T, T);
    paint(new TilePainter(img, 1234 + t * 97));
    ctx.putImageData(img, (t % ATLAS_COLS) * T, Math.floor(t / ATLAS_COLS) * T);
  }
  return canvas;
}

export function createAtlasTexture(): THREE.Texture {
  const tex = new THREE.CanvasTexture(createAtlasCanvas());
  tex.magFilter = THREE.NearestFilter;
  tex.minFilter = THREE.NearestFilter;
  tex.generateMipmaps = false;
  tex.colorSpace = THREE.SRGBColorSpace;
  return tex;
}
