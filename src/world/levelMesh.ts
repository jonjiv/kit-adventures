// Builds the level's visible geometry from its pieces, merged into one mesh per surface.

import * as THREE from 'three';
import { RoundedBoxGeometry } from 'three/addons/geometries/RoundedBoxGeometry.js';
import { mergeGeometries } from 'three/addons/utils/BufferGeometryUtils.js';
import type { LevelFile, Piece } from './levelFormat';
import { surfaceRepeat, surfaceRound, type MaterialLibrary, type SurfaceName } from './materials';
import { buildProp, type Part } from './props';

/** Gives a world-space geometry texture coordinates based on world position, so textures line up everywhere. */
export function applyWorldUVs(g: THREE.BufferGeometry, repeat: number): void {
  const pos = g.attributes.position, nor = g.attributes.normal;
  const uv = new Float32Array(pos.count * 2);
  for (let i = 0; i < pos.count; i++) {
    const ax = Math.abs(nor.getX(i)), ay = Math.abs(nor.getY(i)), az = Math.abs(nor.getZ(i));
    const x = pos.getX(i), y = pos.getY(i), z = pos.getZ(i);
    let u: number, v: number;
    if (ay >= ax && ay >= az) [u, v] = [x, z];
    else if (ax >= az) [u, v] = [z, y];
    else [u, v] = [x, y];
    uv[i * 2] = u / repeat;
    uv[i * 2 + 1] = v / repeat;
  }
  g.setAttribute('uv', new THREE.BufferAttribute(uv, 2));
}

function roundedBox(size: [number, number, number], round: number): THREE.BufferGeometry {
  const r = Math.min(round, Math.min(...size) / 2 - 0.001);
  if (r <= 0.005) return new THREE.BoxGeometry(...size);
  return new RoundedBoxGeometry(size[0], size[1], size[2], 3, r);
}

/**
 * A round, puffy mushroom cap with a pale underside. It bulges a little above
 * its collision top in the middle, so the cat looks like it sinks in.
 */
function mushroomCap(pos: [number, number, number], radius: number, height: number): Part[] {
  const profile = [[radius, 0], [radius * 1.02, height * 0.5], [radius * 0.85, height * 1.0], [radius * 0.55, height * 1.25], [0, height * 1.35]]
    .map(([x, y]) => new THREE.Vector2(x, y));
  const cap = new THREE.LatheGeometry(profile, 24).translate(...pos);
  const under = new THREE.CircleGeometry(radius, 24).rotateX(Math.PI / 2).translate(pos[0], pos[1], pos[2]);
  return [{ surface: 'mushroom', geometry: cap }, { surface: 'white', geometry: under }];
}

function pieceParts(p: Piece): Part[] {
  const center = (pos: number[], size: number[]) => pos.map((v, i) => v + size[i] / 2) as [number, number, number];
  switch (p.kind) {
    case 'box': {
      const g = roundedBox(p.size, p.round ?? surfaceRound(p.mat));
      return [{ surface: p.mat, geometry: g.translate(...center(p.pos, p.size)) }];
    }
    case 'cylinder': {
      if (p.mat === 'mushroom') return mushroomCap(p.pos, p.radius, p.height);
      const segments = Math.max(12, Math.min(32, Math.round(p.radius * 12)));
      const g = new THREE.CylinderGeometry(p.radius, p.radius, p.height, segments);
      return [{ surface: p.mat, geometry: g.translate(p.pos[0], p.pos[1] + p.height / 2, p.pos[2]) }];
    }
    case 'water':
    case 'lava':
      return [{ surface: p.kind, geometry: new THREE.BoxGeometry(...p.size).translate(...center(p.pos, p.size)) }];
    case 'barrier':
      return [];
    case 'prop': {
      const m = new THREE.Matrix4().compose(
        new THREE.Vector3(...p.pos),
        new THREE.Quaternion().setFromAxisAngle(new THREE.Vector3(0, 1, 0), ((p.rot ?? 0) * Math.PI) / 180),
        new THREE.Vector3().setScalar(p.scale ?? 1),
      );
      return buildProp(p.prop).map((part) => ({ ...part, geometry: part.geometry.applyMatrix4(m) }));
    }
  }
}

export function buildLevelMesh(file: LevelFile, materials: MaterialLibrary): THREE.Group {
  const bySurface = new Map<SurfaceName, THREE.BufferGeometry[]>();
  for (const piece of file.pieces) {
    for (const { surface, geometry } of pieceParts(piece)) {
      let g = geometry.index ? geometry.toNonIndexed() : geometry;
      if (g !== geometry) geometry.dispose();
      for (const name of Object.keys(g.attributes)) {
        if (name !== 'position' && name !== 'normal') g.deleteAttribute(name);
      }
      applyWorldUVs(g, surfaceRepeat(surface));
      const list = bySurface.get(surface);
      if (list) list.push(g);
      else bySurface.set(surface, [g]);
    }
  }

  const group = new THREE.Group();
  for (const [surface, list] of bySurface) {
    const merged = mergeGeometries(list);
    list.forEach((g) => g.dispose());
    if (!merged) continue;
    merged.computeBoundingSphere();
    const mesh = new THREE.Mesh(merged, materials.get(surface));
    const seeThrough = materials.isTransparent(surface);
    mesh.castShadow = !seeThrough && surface !== 'lava';
    mesh.receiveShadow = surface !== 'lava';
    if (seeThrough) mesh.renderOrder = 1;
    group.add(mesh);
  }
  return group;
}
