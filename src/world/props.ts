// Ready-made decorations built from simple rounded shapes. Each returns parts
// in local space, with the base center at the origin. Their collision boxes
// are in colliders.ts.

import * as THREE from 'three';
import type { PropName } from './levelFormat';
import type { SurfaceName } from './materials';

export interface Part {
  surface: SurfaceName;
  geometry: THREE.BufferGeometry;
}

const at = (g: THREE.BufferGeometry, x: number, y: number, z: number) => g.translate(x, y, z);
const blob = (r: number, detail = 1) => new THREE.IcosahedronGeometry(r, detail);

function tree(): Part[] {
  const parts: Part[] = [
    { surface: 'bark', geometry: at(new THREE.CylinderGeometry(0.28, 0.38, 3.4, 10), 0, 1.7, 0) },
  ];
  const puffs: [number, number, number, number][] = [
    [1.4, 0, 4.1, 0], [1.1, 0.95, 3.6, 0.3], [1.1, -0.85, 3.7, -0.4], [1.0, 0.1, 4.95, -0.2], [0.9, -0.2, 3.5, 0.9],
  ];
  for (const [r, x, y, z] of puffs) parts.push({ surface: 'leaves', geometry: at(blob(r), x, y, z) });
  return parts;
}

function bush(): Part[] {
  return [
    { surface: 'leaves', geometry: at(blob(0.75), 0, 0.6, 0) },
    { surface: 'leaves', geometry: at(blob(0.55), 0.55, 0.45, 0.2) },
    { surface: 'leaves', geometry: at(blob(0.55), -0.5, 0.45, -0.25) },
  ];
}

function rock(): Part[] {
  return [{ surface: 'stone', geometry: at(blob(0.75, 0).scale(1, 0.6, 1), 0, 0.3, 0) }];
}

function flowers(): Part[] {
  const colors: SurfaceName[] = ['red', 'yellow', 'pink', 'white', 'blue'];
  const spots: [number, number][] = [[0, 0], [0.35, 0.2], [-0.3, 0.25], [0.15, -0.35], [-0.25, -0.25]];
  const parts: Part[] = [];
  spots.forEach(([x, z], i) => {
    const h = 0.35 + (i % 3) * 0.08;
    parts.push({ surface: 'leaves', geometry: at(new THREE.CylinderGeometry(0.025, 0.025, h, 5), x, h / 2, z) });
    parts.push({ surface: colors[i % colors.length], geometry: at(blob(0.1, 0).scale(1, 0.6, 1), x, h, z) });
    parts.push({ surface: 'yellow', geometry: at(blob(0.04, 0), x, h + 0.05, z) });
  });
  return parts;
}

const BUILDERS: Record<PropName, () => Part[]> = { tree, bush, rock, flowers };

export function buildProp(name: PropName): Part[] {
  return BUILDERS[name]();
}
