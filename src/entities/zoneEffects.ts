// What the special areas look like: rising wind streaks above city fans, and
// a soft glowing bubble with floating sparkles for moon low gravity.

import * as THREE from 'three';
import type { Particles } from '../engine/particles';
import type { Zone } from '../world/zones';

const WIND_COLORS = [0xffffff, 0xd8f0ff];
const FLOAT_COLORS = [0xd8a0ff, 0xffffff, 0xa0d0ff];
/** Only zones this close to the cat make particles. */
const NEAR = 60;

export class ZoneEffects {
  readonly group = new THREE.Group();
  private zones: readonly Zone[];
  private owed: number[];
  private bubbles: THREE.MeshBasicMaterial[] = [];

  constructor(zones: readonly Zone[]) {
    this.zones = zones;
    this.owed = zones.map(() => 0);
    for (const z of zones) {
      if (z.kind !== 'lowGravity') continue;
      // Inset a little so the bubble's sides never line up with the path's walls or floor.
      const e = 0.08;
      const size = z.max.map((v, i) => v - z.min[i] - e * 2) as [number, number, number];
      const material = new THREE.MeshBasicMaterial({
        color: 0xe070ff, transparent: true, opacity: 0.16, depthWrite: false, side: THREE.DoubleSide,
      });
      const mesh = new THREE.Mesh(new THREE.BoxGeometry(...size), material);
      mesh.position.set((z.min[0] + z.max[0]) / 2, (z.min[1] + z.max[1]) / 2, (z.min[2] + z.max[2]) / 2);
      mesh.renderOrder = 2;
      this.group.add(mesh);
      this.bubbles.push(material);
    }
  }

  update(dt: number, time: number, cat: THREE.Vector3, particles: Particles): void {
    for (const m of this.bubbles) m.opacity = 0.16 + Math.sin(time * 2) * 0.05;
    const at = new THREE.Vector3();
    this.zones.forEach((z, i) => {
      const cx = Math.max(z.min[0], Math.min(cat.x, z.max[0])), cz = Math.max(z.min[2], Math.min(cat.z, z.max[2]));
      if (Math.hypot(cx - cat.x, cz - cat.z) > NEAR) return;
      const area = (z.max[0] - z.min[0]) * (z.max[2] - z.min[2]);
      const wind = z.kind === 'updraft';
      this.owed[i] += area * dt * (wind ? 1.6 : 0.4);
      while (this.owed[i] >= 1) {
        this.owed[i]--;
        const x = z.min[0] + Math.random() * (z.max[0] - z.min[0]), zz = z.min[2] + Math.random() * (z.max[2] - z.min[2]);
        if (wind) {
          at.set(x, z.min[1] + 0.3, zz);
          particles.burst(at, { count: 1, colors: WIND_COLORS, speed: 0.2, up: 6, life: 1.1, size: 0.1, gravity: -14 });
        } else {
          at.set(x, z.min[1] + Math.random() * (z.max[1] - z.min[1]) * 0.6, zz);
          particles.burst(at, { count: 1, colors: FLOAT_COLORS, speed: 0.3, up: 0.4, life: 2, size: 0.08, gravity: -0.3 });
        }
      }
    });
  }
}
