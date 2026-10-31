import * as THREE from 'three';
import type { LevelObject, Vec3 } from '../world/levelFormat';

const INACTIVE = new THREE.Color(0xe8e4f0);

/** A flag on a pole. Touching it makes it the place the cat comes back to after a fall. */
export class Checkpoint {
  readonly group = new THREE.Group();
  readonly pos: Vec3;
  readonly yaw: number;
  active = false;
  private flag: THREE.Mesh<THREE.PlaneGeometry, THREE.MeshLambertMaterial>;
  private rest: Float32Array;
  private time = Math.random() * 10;
  private cheer = 0;

  constructor(obj: LevelObject) {
    this.pos = [...obj.pos];
    this.yaw = obj.yaw ?? 0;
    this.group.position.fromArray(this.pos);

    const base = new THREE.Mesh(new THREE.CylinderGeometry(0.32, 0.38, 0.14, 16), new THREE.MeshLambertMaterial({ color: 0x9a9ea6 }));
    base.position.y = 0.07;
    const pole = new THREE.Mesh(new THREE.CylinderGeometry(0.045, 0.045, 1.9, 10), new THREE.MeshLambertMaterial({ color: 0xffffff }));
    pole.position.y = 0.95;
    const knob = new THREE.Mesh(new THREE.SphereGeometry(0.09, 12, 10), new THREE.MeshLambertMaterial({ color: 0xffd040 }));
    knob.position.y = 1.92;

    const cloth = new THREE.PlaneGeometry(0.8, 0.5, 10, 4).translate(0.42, 1.6, 0);
    this.rest = Float32Array.from(cloth.attributes.position.array as Float32Array);
    this.flag = new THREE.Mesh(cloth, new THREE.MeshLambertMaterial({ color: INACTIVE, side: THREE.DoubleSide }));
    this.group.add(base, pole, knob, this.flag);
    this.group.traverse((o) => { o.castShadow = true; });
  }

  /** True if the cat (feet at p) is touching the flag. */
  touches(p: Vec3): boolean {
    const dx = p[0] - this.pos[0], dz = p[2] - this.pos[2];
    return dx * dx + dz * dz < 1.6 * 1.6 && p[1] > this.pos[1] - 1 && p[1] < this.pos[1] + 2.5;
  }

  activate(): void {
    this.active = true;
    this.cheer = 1;
  }

  deactivate(): void {
    this.active = false;
  }

  update(dt: number): void {
    this.time += dt;
    this.cheer = Math.max(0, this.cheer - dt);
    // Wave the cloth: more toward the free end, faster when just touched.
    const pos = this.flag.geometry.attributes.position;
    const speed = this.active ? 5 + this.cheer * 8 : 2.5;
    for (let i = 0; i < pos.count; i++) {
      const x = this.rest[i * 3] - 0.02;
      pos.setZ(i, Math.sin(x * 7 - this.time * speed) * 0.07 * x * 2);
    }
    pos.needsUpdate = true;
    this.flag.geometry.computeVertexNormals();
    if (this.active) this.flag.material.color.setHSL((this.time * 0.15) % 1, 0.8, 0.6);
    else this.flag.material.color.copy(INACTIVE);
    this.group.scale.setScalar(1 + Math.sin(this.cheer * Math.PI) * 0.15);
  }

  dispose(): void {
    this.group.traverse((o) => {
      if (o instanceof THREE.Mesh) {
        o.geometry.dispose();
        (o.material as THREE.Material).dispose();
      }
    });
  }
}
