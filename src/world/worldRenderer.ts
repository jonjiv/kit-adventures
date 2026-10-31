import * as THREE from 'three';
import type { RenderGroup } from './blocks';
import { meshChunk, RENDER_GROUPS, type MeshData } from './mesher';
import type { World } from './world';

export const CHUNK_SIZE = 16;

/** Draws the block world as 16x16x16 chunks and rebuilds a chunk when a block changes. */
export class WorldRenderer {
  readonly group = new THREE.Group();
  private world: World;
  private materials: Record<RenderGroup, THREE.Material>;
  private chunks = new Map<string, THREE.Mesh[]>();

  constructor(world: World, atlas: THREE.Texture) {
    this.world = world;
    this.materials = {
      opaque: new THREE.MeshLambertMaterial({ map: atlas, vertexColors: true }),
      cutout: new THREE.MeshLambertMaterial({ map: atlas, vertexColors: true, alphaTest: 0.5 }),
      water: new THREE.MeshLambertMaterial({
        map: atlas, vertexColors: true, transparent: true, opacity: 0.72,
        depthWrite: false, side: THREE.DoubleSide,
      }),
      glow: new THREE.MeshBasicMaterial({ map: atlas, vertexColors: true }),
    };
    this.buildAll();
  }

  private chunkCounts() {
    return [this.world.sx, this.world.sy, this.world.sz].map((n) => Math.ceil(n / CHUNK_SIZE));
  }

  buildAll(): void {
    const [cx, cy, cz] = this.chunkCounts();
    for (let y = 0; y < cy; y++) for (let z = 0; z < cz; z++) for (let x = 0; x < cx; x++) this.rebuildChunk(x, y, z);
  }

  rebuildChunk(cx: number, cy: number, cz: number): void {
    const key = `${cx},${cy},${cz}`;
    for (const mesh of this.chunks.get(key) ?? []) {
      this.group.remove(mesh);
      mesh.geometry.dispose();
    }
    const data = meshChunk(this.world, cx * CHUNK_SIZE, cy * CHUNK_SIZE, cz * CHUNK_SIZE, CHUNK_SIZE);
    const meshes: THREE.Mesh[] = [];
    for (const group of RENDER_GROUPS) {
      if (data[group].indices.length === 0) continue;
      const mesh = new THREE.Mesh(toGeometry(data[group]), this.materials[group]);
      mesh.castShadow = group === 'opaque' || group === 'cutout';
      mesh.receiveShadow = group !== 'glow';
      if (group === 'water') mesh.renderOrder = 1;
      this.group.add(mesh);
      meshes.push(mesh);
    }
    this.chunks.set(key, meshes);
  }

  /** Changes one block and redraws every chunk whose faces or shading it touches. */
  setBlock(x: number, y: number, z: number, id: number): void {
    if (!this.world.inBounds(x, y, z) || this.world.get(x, y, z) === id) return;
    this.world.set(x, y, z, id);
    const keys = new Set<string>();
    const [cx, cy, cz] = this.chunkCounts();
    for (let dy = -1; dy <= 1; dy++) for (let dz = -1; dz <= 1; dz++) for (let dx = -1; dx <= 1; dx++) {
      const kx = Math.floor((x + dx) / CHUNK_SIZE), ky = Math.floor((y + dy) / CHUNK_SIZE), kz = Math.floor((z + dz) / CHUNK_SIZE);
      if (kx < 0 || ky < 0 || kz < 0 || kx >= cx || ky >= cy || kz >= cz) continue;
      keys.add(`${kx},${ky},${kz}`);
    }
    for (const key of keys) {
      const [kx, ky, kz] = key.split(',').map(Number);
      this.rebuildChunk(kx, ky, kz);
    }
  }

  dispose(): void {
    for (const meshes of this.chunks.values()) for (const m of meshes) m.geometry.dispose();
    this.chunks.clear();
    this.group.clear();
    for (const m of Object.values(this.materials)) m.dispose();
  }
}

function toGeometry(d: MeshData): THREE.BufferGeometry {
  const g = new THREE.BufferGeometry();
  g.setAttribute('position', new THREE.Float32BufferAttribute(d.positions, 3));
  g.setAttribute('normal', new THREE.Float32BufferAttribute(d.normals, 3));
  g.setAttribute('uv', new THREE.Float32BufferAttribute(d.uvs, 2));
  g.setAttribute('color', new THREE.Float32BufferAttribute(d.colors, 3));
  g.setIndex(d.indices);
  g.computeBoundingSphere();
  return g;
}
