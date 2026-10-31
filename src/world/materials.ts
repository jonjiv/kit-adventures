// N64-style surfaces: small, soft textures painted in code, smoothly filtered
// and tiled in world space so every surface has the same texture size.

import * as THREE from 'three';
import type { MaterialName } from './levelFormat';

/** Every material the renderer knows: the level materials plus water and lava. */
export type SurfaceName = MaterialName | 'water' | 'lava';

const SIZE = 64;

function rng(seed: number) {
  return () => {
    seed = (seed * 16807) % 2147483647;
    return (seed - 1) / 2147483646;
  };
}

type Painter = (ctx: CanvasRenderingContext2D, r: () => number) => void;

const shade = (hex: number, amount: number) => {
  const c = new THREE.Color(hex);
  c.offsetHSL(0, 0, amount);
  return `#${c.getHexString()}`;
};

/** Soft blotches of lighter and darker color. */
function blotches(ctx: CanvasRenderingContext2D, r: () => number, base: number, count: number, spread: number, size: number) {
  for (let i = 0; i < count; i++) {
    ctx.fillStyle = shade(base, (r() - 0.5) * spread);
    const x = r() * SIZE, y = r() * SIZE, s = size * (0.5 + r());
    for (const dx of [-SIZE, 0, SIZE]) for (const dy of [-SIZE, 0, SIZE]) {
      ctx.beginPath();
      ctx.ellipse(x + dx, y + dy, s, s * 0.8, 0, 0, Math.PI * 2);
      ctx.fill();
    }
  }
}

function flat(base: number): Painter {
  return (ctx, r) => {
    ctx.fillStyle = shade(base, 0);
    ctx.fillRect(0, 0, SIZE, SIZE);
    blotches(ctx, r, base, 30, 0.04, 6);
  };
}

interface SurfaceDef {
  paint: Painter;
  /** Meters covered by one copy of the texture. */
  repeat: number;
  /** Default corner rounding for boxes, in meters. */
  round: number;
  kind?: 'water' | 'glow' | 'glass';
}

const SURFACES: Record<SurfaceName, SurfaceDef> = {
  grass: {
    repeat: 3, round: 0.12,
    paint: (ctx, r) => {
      ctx.fillStyle = '#58b848';
      ctx.fillRect(0, 0, SIZE, SIZE);
      blotches(ctx, r, 0x58b848, 40, 0.1, 7);
      for (let i = 0; i < 260; i++) {
        ctx.fillStyle = shade(0x58b848, (r() - 0.4) * 0.2);
        ctx.fillRect(r() * SIZE, r() * SIZE, 1, 3);
      }
    },
  },
  dirt: { repeat: 3, round: 0.12, paint: (ctx, r) => { flat(0x9a6b44)(ctx, r); blotches(ctx, r, 0x9a6b44, 50, 0.14, 4); } },
  wood: {
    repeat: 2, round: 0.06,
    paint: (ctx, r) => {
      const plank = SIZE / 4;
      for (let i = 0; i < 4; i++) {
        const base = new THREE.Color(0xc89458).offsetHSL(0, 0, (r() - 0.5) * 0.08).getHex();
        ctx.fillStyle = shade(base, 0);
        ctx.fillRect(0, i * plank, SIZE, plank);
        ctx.strokeStyle = shade(base, -0.08);
        ctx.lineWidth = 1;
        for (let g = 0; g < 3; g++) {
          ctx.beginPath();
          const y = i * plank + 3 + g * 4 + r() * 2;
          ctx.moveTo(0, y);
          for (let x = 0; x <= SIZE; x += 8) ctx.lineTo(x, y + Math.sin(x * 0.2 + r() * 6) * 1.2);
          ctx.stroke();
        }
        ctx.fillStyle = shade(base, -0.2);
        ctx.fillRect(0, i * plank + plank - 1.5, SIZE, 1.5);
      }
    },
  },
  bark: {
    repeat: 1.5, round: 0.06,
    paint: (ctx, r) => {
      ctx.fillStyle = '#7a5434';
      ctx.fillRect(0, 0, SIZE, SIZE);
      for (let i = 0; i < 18; i++) {
        ctx.fillStyle = shade(0x7a5434, (r() - 0.6) * 0.15);
        ctx.fillRect(r() * SIZE, 0, 2 + r() * 3, SIZE);
      }
    },
  },
  stone: {
    repeat: 2.5, round: 0.15,
    paint: (ctx, r) => {
      ctx.fillStyle = '#80848c';
      ctx.fillRect(0, 0, SIZE, SIZE);
      blotches(ctx, r, 0x9a9ea6, 26, 0.12, 9);
      blotches(ctx, r, 0x8a8e96, 40, 0.08, 4);
    },
  },
  brick: {
    repeat: 2, round: 0.05,
    paint: (ctx, r) => {
      ctx.fillStyle = '#d8d0c4';
      ctx.fillRect(0, 0, SIZE, SIZE);
      const bw = 32, bh = 16;
      for (let row = 0; row < 4; row++) {
        for (let col = -1; col < 3; col++) {
          const x = col * bw + (row % 2 ? bw / 2 : 0);
          ctx.fillStyle = shade(0xc0583e, (r() - 0.5) * 0.1);
          ctx.fillRect(x + 1.5, row * bh + 1.5, bw - 3, bh - 3);
        }
      }
    },
  },
  glass: {
    repeat: 2, round: 0.04, kind: 'glass',
    paint: (ctx) => {
      ctx.fillStyle = '#d8f0ff';
      ctx.fillRect(0, 0, SIZE, SIZE);
      ctx.fillStyle = '#ffffff';
      ctx.beginPath();
      ctx.moveTo(10, 40); ctx.lineTo(30, 20); ctx.lineTo(36, 20); ctx.lineTo(16, 40);
      ctx.fill();
    },
  },
  carpet: { repeat: 2, round: 0.08, paint: (ctx, r) => { flat(0x8c62d0)(ctx, r); blotches(ctx, r, 0x8c62d0, 60, 0.06, 2); } },
  fabric: {
    repeat: 1, round: 0.2,
    paint: (ctx, r) => {
      ctx.fillStyle = '#4a7cc8';
      ctx.fillRect(0, 0, SIZE, SIZE);
      for (let i = 0; i < SIZE; i += 4) {
        ctx.fillStyle = shade(0x4a7cc8, 0.04);
        ctx.fillRect(i, 0, 2, SIZE);
        ctx.fillStyle = shade(0x4a7cc8, -0.04);
        ctx.fillRect(0, i, SIZE, 2);
      }
      blotches(ctx, r, 0x4a7cc8, 10, 0.03, 8);
    },
  },
  roof: {
    repeat: 2, round: 0.05,
    paint: (ctx, r) => {
      ctx.fillStyle = '#9a4428';
      ctx.fillRect(0, 0, SIZE, SIZE);
      for (let row = 0; row < 4; row++) {
        for (let col = -1; col < 5; col++) {
          const x = col * 16 + (row % 2 ? 8 : 0);
          ctx.fillStyle = shade(0xc8603a, (r() - 0.5) * 0.08);
          ctx.beginPath();
          ctx.ellipse(x + 8, row * 16 + 6, 7.5, 10, 0, 0, Math.PI);
          ctx.fill();
        }
      }
    },
  },
  plaster: { repeat: 3, round: 0.05, paint: flat(0xf2ead8) },
  metal: {
    repeat: 2, round: 0.05,
    paint: (ctx, r) => {
      ctx.fillStyle = '#a8b0b8';
      ctx.fillRect(0, 0, SIZE, SIZE);
      for (let i = 0; i < 40; i++) {
        ctx.fillStyle = shade(0xa8b0b8, (r() - 0.5) * 0.08);
        ctx.fillRect(0, r() * SIZE, SIZE, 1);
      }
    },
  },
  leaves: {
    repeat: 2, round: 0.35,
    paint: (ctx, r) => {
      ctx.fillStyle = '#3c9440';
      ctx.fillRect(0, 0, SIZE, SIZE);
      blotches(ctx, r, 0x4caa48, 70, 0.16, 4);
    },
  },
  white: { repeat: 2, round: 0.08, paint: flat(0xf8f8f4) },
  red: { repeat: 2, round: 0.08, paint: flat(0xe04848) },
  yellow: { repeat: 2, round: 0.08, paint: flat(0xf8d040) },
  blue: { repeat: 2, round: 0.08, paint: flat(0x4890e8) },
  pink: { repeat: 2, round: 0.08, paint: flat(0xf090c0) },
  water: {
    repeat: 4, round: 0, kind: 'water',
    paint: (ctx, r) => {
      ctx.fillStyle = '#3a88e0';
      ctx.fillRect(0, 0, SIZE, SIZE);
      blotches(ctx, r, 0x4a98f0, 20, 0.1, 8);
      ctx.strokeStyle = 'rgba(255,255,255,0.45)';
      ctx.lineWidth = 1.5;
      for (let i = 0; i < 6; i++) {
        const x = r() * SIZE, y = r() * SIZE;
        ctx.beginPath();
        ctx.arc(x, y, 5 + r() * 4, Math.PI * 1.1, Math.PI * 1.9);
        ctx.stroke();
      }
    },
  },
  lava: {
    repeat: 3, round: 0, kind: 'glow',
    paint: (ctx, r) => {
      ctx.fillStyle = '#ff6a18';
      ctx.fillRect(0, 0, SIZE, SIZE);
      blotches(ctx, r, 0xff8a20, 20, 0.1, 9);
      blotches(ctx, r, 0xffd040, 12, 0.08, 4);
    },
  },
};

export function surfaceRepeat(name: SurfaceName): number {
  return SURFACES[name].repeat;
}

export function surfaceRound(name: SurfaceName): number {
  return SURFACES[name].round;
}

function makeTexture(name: SurfaceName, def: SurfaceDef): THREE.Texture {
  const canvas = document.createElement('canvas');
  canvas.width = canvas.height = SIZE;
  const ctx = canvas.getContext('2d')!;
  let seed = 7;
  for (const ch of name) seed = (seed * 31 + ch.charCodeAt(0)) % 2147483647;
  def.paint(ctx, rng(seed));
  const tex = new THREE.CanvasTexture(canvas);
  tex.wrapS = tex.wrapT = THREE.RepeatWrapping;
  tex.colorSpace = THREE.SRGBColorSpace;
  tex.anisotropy = 4;
  return tex;
}

/** Creates one shared Three.js material per surface. */
export class MaterialLibrary {
  private cache = new Map<SurfaceName, THREE.Material>();
  private animated: THREE.Texture[] = [];

  get(name: SurfaceName): THREE.Material {
    let m = this.cache.get(name);
    if (m) return m;
    const def = SURFACES[name];
    const map = makeTexture(name, def);
    if (def.kind === 'glow') {
      m = new THREE.MeshBasicMaterial({ map });
      this.animated.push(map);
    } else if (def.kind === 'water') {
      m = new THREE.MeshLambertMaterial({ map, transparent: true, opacity: 0.75, depthWrite: false, side: THREE.DoubleSide });
      this.animated.push(map);
    } else if (def.kind === 'glass') {
      m = new THREE.MeshLambertMaterial({ map, transparent: true, opacity: 0.4, depthWrite: false });
    } else {
      m = new THREE.MeshLambertMaterial({ map });
    }
    this.cache.set(name, m);
    return m;
  }

  isTransparent(name: SurfaceName): boolean {
    const kind = SURFACES[name].kind;
    return kind === 'water' || kind === 'glass';
  }

  /** Slowly slides water and lava textures so they look alive. */
  update(time: number): void {
    for (const t of this.animated) t.offset.set(Math.sin(time * 0.3) * 0.05, time * 0.03);
  }

  dispose(): void {
    for (const m of this.cache.values()) {
      (m as THREE.MeshLambertMaterial).map?.dispose();
      m.dispose();
    }
    this.cache.clear();
  }
}
