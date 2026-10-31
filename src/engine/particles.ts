import * as THREE from 'three';

interface Particle {
  mesh: THREE.Mesh;
  vel: THREE.Vector3;
  life: number;
  maxLife: number;
  size: number;
  gravity: number;
}

export interface BurstOptions {
  count: number;
  colors: number[];
  /** Starting speed in meters per second. */
  speed: number;
  /** Seconds each piece lasts. */
  life: number;
  size: number;
  gravity?: number;
  /** Extra upward speed. */
  up?: number;
  /** Only spread sideways (for dust rings on landing). */
  flat?: boolean;
}

/** Small shrinking sparkles and puffs, reused from a pool. */
export class Particles {
  readonly group = new THREE.Group();
  private geometry = new THREE.OctahedronGeometry(1, 0);
  private materials = new Map<number, THREE.MeshBasicMaterial>();
  private live: Particle[] = [];
  private free: THREE.Mesh[] = [];

  private material(color: number): THREE.MeshBasicMaterial {
    let m = this.materials.get(color);
    if (!m) {
      m = new THREE.MeshBasicMaterial({ color, transparent: true, opacity: 0.9 });
      this.materials.set(color, m);
    }
    return m;
  }

  burst(at: THREE.Vector3, o: BurstOptions): void {
    for (let i = 0; i < o.count; i++) {
      const mesh = this.free.pop() ?? new THREE.Mesh(this.geometry);
      mesh.material = this.material(o.colors[i % o.colors.length]);
      mesh.position.copy(at);
      mesh.rotation.set(Math.random() * 3, Math.random() * 3, 0);
      const angle = (i / o.count) * Math.PI * 2 + Math.random() * 0.5;
      const lift = o.flat ? 0.1 : Math.random() * 2 - 0.6;
      const vel = new THREE.Vector3(Math.cos(angle), lift, Math.sin(angle)).normalize().multiplyScalar(o.speed * (0.6 + Math.random() * 0.6));
      vel.y += o.up ?? 0;
      this.group.add(mesh);
      this.live.push({ mesh, vel, life: o.life, maxLife: o.life, size: o.size, gravity: o.gravity ?? 0 });
    }
  }

  update(dt: number): void {
    for (let i = this.live.length - 1; i >= 0; i--) {
      const p = this.live[i];
      p.life -= dt;
      if (p.life <= 0) {
        this.group.remove(p.mesh);
        this.free.push(p.mesh);
        this.live.splice(i, 1);
        continue;
      }
      p.vel.y -= p.gravity * dt;
      p.vel.multiplyScalar(1 - 2.5 * dt);
      p.mesh.position.addScaledVector(p.vel, dt);
      p.mesh.rotation.y += dt * 6;
      p.mesh.scale.setScalar(p.size * (p.life / p.maxLife));
    }
  }
}
