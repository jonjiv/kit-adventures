import * as THREE from 'three';
import { TUNING } from '../player/tuning';
import type { Input } from './input';

/** Free-fly camera: mouse looks, WASD moves, Space goes up, Shift goes down. */
export class FlyCamera {
  yaw = 0;
  pitch = 0;
  private camera: THREE.PerspectiveCamera;
  private velocity = new THREE.Vector3();

  constructor(camera: THREE.PerspectiveCamera) {
    this.camera = camera;
    camera.rotation.order = 'YXZ';
  }

  lookAt(target: THREE.Vector3): void {
    const d = target.clone().sub(this.camera.position);
    this.yaw = Math.atan2(-d.x, -d.z);
    this.pitch = Math.atan2(d.y, Math.hypot(d.x, d.z));
    this.applyRotation();
  }

  update(dt: number, input: Input): void {
    const { dx, dy } = input.takeMouse();
    const maxPitch = THREE.MathUtils.degToRad(TUNING.mouse.maxPitch);
    this.yaw -= dx * TUNING.mouse.sensitivity;
    this.pitch = THREE.MathUtils.clamp(this.pitch - dy * TUNING.mouse.sensitivity, -maxPitch, maxPitch);
    this.applyRotation();

    const move = input.moveAxes();
    const up = (input.isDown('Space') ? 1 : 0) - (input.isDown('ShiftLeft') || input.isDown('ShiftRight') ? 1 : 0);
    const forward = new THREE.Vector3(-Math.sin(this.yaw), 0, -Math.cos(this.yaw));
    const right = new THREE.Vector3(Math.cos(this.yaw), 0, -Math.sin(this.yaw));
    const wish = forward.multiplyScalar(move.y).add(right.multiplyScalar(move.x));
    if (wish.lengthSq() > 1) wish.normalize();
    wish.multiplyScalar(TUNING.fly.speed);
    wish.y = up * TUNING.fly.verticalSpeed;

    const blend = 1 - Math.exp(-TUNING.fly.smoothing * dt);
    this.velocity.lerp(wish, blend);
    this.camera.position.addScaledVector(this.velocity, dt);
  }

  private applyRotation(): void {
    this.camera.rotation.set(this.pitch, this.yaw, 0);
  }
}
