// Draws the home-screen icon (an orange kitten face on sky blue) and saves it
// as PNG files in public/icons. Run with: node scripts/make-icons.ts
// Everything is drawn in code: no outside art.

import { mkdirSync, writeFileSync } from 'node:fs';
import { deflateSync } from 'node:zlib';

type RGB = [number, number, number];
/** A shape: returns true if the point (in 0..1 icon space, y down) is inside it. */
type Shape = (x: number, y: number) => boolean;

const circle = (cx: number, cy: number, r: number): Shape => (x, y) => (x - cx) ** 2 + (y - cy) ** 2 <= r * r;
const ellipse = (cx: number, cy: number, rx: number, ry: number): Shape => (x, y) =>
  ((x - cx) / rx) ** 2 + ((y - cy) / ry) ** 2 <= 1;
const triangle = (a: [number, number], b: [number, number], c: [number, number]): Shape => (x, y) => {
  const side = (p: [number, number], q: [number, number]) => (q[0] - p[0]) * (y - p[1]) - (q[1] - p[1]) * (x - p[0]);
  const d1 = side(a, b), d2 = side(b, c), d3 = side(c, a);
  return !((d1 < 0 || d2 < 0 || d3 < 0) && (d1 > 0 || d2 > 0 || d3 > 0));
};

const SKY: RGB = [74, 168, 255];
const SKY_LOW: RGB = [160, 220, 255];
const FUR: RGB = [255, 160, 64];
const STRIPE: RGB = [214, 110, 30];
const PINK: RGB = [255, 150, 180];
const WHITE: RGB = [255, 255, 255];
const EYE: RGB = [70, 190, 90];
const DARK: RGB = [40, 30, 50];

// Painted in order; later shapes cover earlier ones. The face stays inside the
// middle 80% so it survives being cut into a circle ("maskable" icons).
const LAYERS: [Shape, RGB][] = [
  [triangle([0.2, 0.42], [0.25, 0.14], [0.45, 0.3]), FUR],
  [triangle([0.8, 0.42], [0.75, 0.14], [0.55, 0.3]), FUR],
  [triangle([0.25, 0.37], [0.27, 0.21], [0.39, 0.31]), PINK],
  [triangle([0.75, 0.37], [0.73, 0.21], [0.61, 0.31]), PINK],
  [ellipse(0.5, 0.56, 0.32, 0.27), FUR],
  [ellipse(0.5, 0.36, 0.035, 0.06), STRIPE],
  [ellipse(0.42, 0.38, 0.025, 0.045), STRIPE],
  [ellipse(0.58, 0.38, 0.025, 0.045), STRIPE],
  [ellipse(0.5, 0.68, 0.13, 0.09), WHITE],
  [circle(0.38, 0.54, 0.075), DARK],
  [circle(0.62, 0.54, 0.075), DARK],
  [circle(0.38, 0.55, 0.055), EYE],
  [circle(0.62, 0.55, 0.055), EYE],
  [circle(0.38, 0.555, 0.033), DARK],
  [circle(0.62, 0.555, 0.033), DARK],
  [circle(0.36, 0.52, 0.018), WHITE],
  [circle(0.6, 0.52, 0.018), WHITE],
  [ellipse(0.27, 0.65, 0.045, 0.028), PINK],
  [ellipse(0.73, 0.65, 0.045, 0.028), PINK],
  [triangle([0.47, 0.63], [0.53, 0.63], [0.5, 0.665]), PINK],
];

function colorAt(x: number, y: number): RGB {
  let c: RGB = [0, 0, 0];
  for (let i = 0; i < 3; i++) c[i] = SKY[i] + (SKY_LOW[i] - SKY[i]) * y;
  for (const [shape, color] of LAYERS) if (shape(x, y)) c = color;
  return c;
}

/** Draws the icon at `size` pixels, with 4×4 samples per pixel for smooth edges. */
function draw(size: number): Buffer {
  const SS = 4;
  const raw = Buffer.alloc(size * (size * 3 + 1));
  for (let py = 0; py < size; py++) {
    raw[py * (size * 3 + 1)] = 0; // PNG row filter: none
    for (let px = 0; px < size; px++) {
      const sum = [0, 0, 0];
      for (let sy = 0; sy < SS; sy++) {
        for (let sx = 0; sx < SS; sx++) {
          const c = colorAt((px + (sx + 0.5) / SS) / size, (py + (sy + 0.5) / SS) / size);
          for (let i = 0; i < 3; i++) sum[i] += c[i];
        }
      }
      const o = py * (size * 3 + 1) + 1 + px * 3;
      for (let i = 0; i < 3; i++) raw[o + i] = Math.round(sum[i] / (SS * SS));
    }
  }
  return png(size, raw);
}

const CRC_TABLE = Array.from({ length: 256 }, (_, n) => {
  let c = n;
  for (let k = 0; k < 8; k++) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1;
  return c >>> 0;
});

function crc32(buf: Buffer): number {
  let c = 0xffffffff;
  for (const b of buf) c = CRC_TABLE[(c ^ b) & 0xff] ^ (c >>> 8);
  return (c ^ 0xffffffff) >>> 0;
}

function chunk(type: string, data: Buffer): Buffer {
  const len = Buffer.alloc(4);
  len.writeUInt32BE(data.length);
  const body = Buffer.concat([Buffer.from(type, 'ascii'), data]);
  const crc = Buffer.alloc(4);
  crc.writeUInt32BE(crc32(body));
  return Buffer.concat([len, body, crc]);
}

function png(size: number, raw: Buffer): Buffer {
  const header = Buffer.alloc(13);
  header.writeUInt32BE(size, 0);
  header.writeUInt32BE(size, 4);
  header[8] = 8; // bits per channel
  header[9] = 2; // RGB
  return Buffer.concat([
    Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]),
    chunk('IHDR', header),
    chunk('IDAT', deflateSync(raw, { level: 9 })),
    chunk('IEND', Buffer.alloc(0)),
  ]);
}

const dir = new URL('../public/icons/', import.meta.url);
mkdirSync(dir, { recursive: true });
for (const [name, size] of [['icon-192.png', 192], ['icon-512.png', 512], ['apple-touch-icon.png', 180]] as const) {
  writeFileSync(new URL(name, dir), draw(size));
  console.log(`wrote public/icons/${name}`);
}
