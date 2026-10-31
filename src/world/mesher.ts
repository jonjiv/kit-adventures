// Turns a chunk of the block grid into triangle data, one list per render group.
// Only faces next to see-through cells are kept. Opaque blocks get simple
// per-corner ambient occlusion so edges and corners read clearly.

import { ATLAS_COLS, ATLAS_ROWS, ATLAS_TILE, BLOCKS, isOpaque, type RenderGroup } from './blocks';

export interface BlockSource {
  get(x: number, y: number, z: number): number;
}

export interface MeshData {
  positions: number[];
  normals: number[];
  uvs: number[];
  colors: number[];
  indices: number[];
}

export type ChunkMeshData = Record<RenderGroup, MeshData>;

export const RENDER_GROUPS: readonly RenderGroup[] = ['opaque', 'cutout', 'water', 'glow'];

/** Height of a liquid's top surface when nothing is stacked on it. */
export const LIQUID_SURFACE = 0.85;

type V3 = readonly [number, number, number];

// Each face is an origin corner plus edge vectors u (texture right) and v
// (texture up), chosen so u x v points out of the block.
interface FaceDef {
  n: V3;
  o: V3;
  u: V3;
  v: V3;
  tex: 'top' | 'side' | 'bottom';
  /** Brightness for groups without ambient occlusion. */
  shade: number;
}

const FACES: readonly FaceDef[] = [
  { n: [1, 0, 0], o: [1, 0, 1], u: [0, 0, -1], v: [0, 1, 0], tex: 'side', shade: 0.85 },
  { n: [-1, 0, 0], o: [0, 0, 0], u: [0, 0, 1], v: [0, 1, 0], tex: 'side', shade: 0.85 },
  { n: [0, 1, 0], o: [0, 1, 1], u: [1, 0, 0], v: [0, 0, -1], tex: 'top', shade: 1 },
  { n: [0, -1, 0], o: [0, 0, 0], u: [1, 0, 0], v: [0, 0, 1], tex: 'bottom', shade: 0.6 },
  { n: [0, 0, 1], o: [0, 0, 1], u: [1, 0, 0], v: [0, 1, 0], tex: 'side', shade: 0.75 },
  { n: [0, 0, -1], o: [1, 0, 0], u: [-1, 0, 0], v: [0, 1, 0], tex: 'side', shade: 0.75 },
];

const CORNERS: readonly (readonly [number, number])[] = [[0, 0], [1, 0], [1, 1], [0, 1]];
const AO_BRIGHTNESS = [0.45, 0.65, 0.82, 1];

const emptyMesh = (): MeshData => ({ positions: [], normals: [], uvs: [], colors: [], indices: [] });

export function shouldDrawFace(self: number, other: number): boolean {
  if (isOpaque(other)) return false;
  return other !== self;
}

function tileUV(tile: number) {
  const w = ATLAS_COLS * ATLAS_TILE;
  const h = ATLAS_ROWS * ATLAS_TILE;
  const col = tile % ATLAS_COLS;
  const row = Math.floor(tile / ATLAS_COLS);
  const inset = 0.25; // texels, stops neighboring tiles bleeding in
  return {
    u0: (col * ATLAS_TILE + inset) / w,
    u1: ((col + 1) * ATLAS_TILE - inset) / w,
    vTop: 1 - (row * ATLAS_TILE + inset) / h,
    vBottom: 1 - ((row + 1) * ATLAS_TILE - inset) / h,
  };
}

export function meshChunk(
  src: BlockSource, x0: number, y0: number, z0: number, size: number,
): ChunkMeshData {
  const out: ChunkMeshData = { opaque: emptyMesh(), cutout: emptyMesh(), water: emptyMesh(), glow: emptyMesh() };
  const occ = (x: number, y: number, z: number) => (isOpaque(src.get(x, y, z)) ? 1 : 0);
  const ao = [1, 1, 1, 1];

  for (let y = y0; y < y0 + size; y++) {
    for (let z = z0; z < z0 + size; z++) {
      for (let x = x0; x < x0 + size; x++) {
        const id = src.get(x, y, z);
        const def = BLOCKS[id];
        if (!def || def.render === 'none') continue;
        const mesh = out[def.render];
        const useAO = def.render === 'opaque';

        let top = 1;
        if (def.liquid) {
          const above = src.get(x, y + 1, z);
          if (above !== id && !isOpaque(above)) top = LIQUID_SURFACE;
        }

        for (const f of FACES) {
          const nx = x + f.n[0], ny = y + f.n[1], nz = z + f.n[2];
          if (!shouldDrawFace(id, src.get(nx, ny, nz))) continue;

          const base = mesh.positions.length / 3;
          const uv = tileUV(def.tex[f.tex]);
          for (let k = 0; k < 4; k++) {
            const [a, b] = CORNERS[k];
            const lx = f.o[0] + a * f.u[0] + b * f.v[0];
            const ly = f.o[1] + a * f.u[1] + b * f.v[1];
            const lz = f.o[2] + a * f.u[2] + b * f.v[2];
            mesh.positions.push(x + lx, y + (ly === 1 ? top : ly), z + lz);
            mesh.normals.push(f.n[0], f.n[1], f.n[2]);
            mesh.uvs.push(a ? uv.u1 : uv.u0, b ? uv.vTop : uv.vBottom);

            let light = f.shade;
            if (useAO) {
              const su = a ? 1 : -1, sv = b ? 1 : -1;
              const s1 = occ(nx + su * f.u[0], ny + su * f.u[1], nz + su * f.u[2]);
              const s2 = occ(nx + sv * f.v[0], ny + sv * f.v[1], nz + sv * f.v[2]);
              const c = occ(
                nx + su * f.u[0] + sv * f.v[0],
                ny + su * f.u[1] + sv * f.v[1],
                nz + su * f.u[2] + sv * f.v[2],
              );
              light = AO_BRIGHTNESS[s1 && s2 ? 0 : 3 - (s1 + s2 + c)];
            }
            ao[k] = light;
            mesh.colors.push(light, light, light);
          }
          // Split the quad along the brighter diagonal so shading doesn't look creased.
          if (useAO && ao[0] + ao[2] < ao[1] + ao[3]) {
            mesh.indices.push(base, base + 1, base + 3, base + 1, base + 2, base + 3);
          } else {
            mesh.indices.push(base, base + 1, base + 2, base, base + 2, base + 3);
          }
        }
      }
    }
  }
  return out;
}
