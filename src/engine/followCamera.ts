import * as THREE from 'three';
import { TUNING } from '../player/tuning';
import type { CollisionWorld } from '../world/collision';
import type { Input } from './input';

/**
 * Third-person camera that orbits behind the cat. The mouse turns it, the
 * wheel zooms, and it slides in closer when a wall is in the way.
 */
export class FollowCamera {
  /** Angle around the cat (0 = camera on the +Z side, looking toward -Z). */
  yaw = 0;
  /** Height angle in radians (positive = above the cat, looking down). */
  pitch = THREE.MathUtils.degToRad(TUNING.camera.pitch);
  distance = TUNING.camera.distance;
  private camera: THREE.PerspectiveCamera;
  private world: CollisionWorld;
  private current = TUNING.camera.distance;
  private lookY = 0;
  private target = new THREE.Vector3();

  constructor(camera: THREE.PerspectiveCamera, world: CollisionWorld) {
    this.camera = camera;
    this.world = world;
  }

  get position(): THREE.Vector3 {
    return this.camera.position;
  }

  /** Jumps straight to the cat with no smoothing (at level start and respawn). */
  snap(focus: THREE.Vector3, yaw?: number): void {
    if (yaw !== undefined) this.yaw = yaw;
    this.lookY = focus.y + TUNING.camera.lookHeight;
    this.current = this.distance;
    this.place(focus, 0);
  }

  /** Turns stick or key input (x right, y forward) into a world direction based on where the camera faces. */
  moveIntent(axes: { x: number; y: number }): { x: number; z: number } {
    const s = Math.sin(this.yaw), c = Math.cos(this.yaw);
    return { x: -s * axes.y + c * axes.x, z: -c * axes.y - s * axes.x };
  }

  update(dt: number, input: Input, focus: THREE.Vector3): void {
    const cam = TUNING.camera;
    const { dx, dy } = input.takeMouse();
    this.yaw -= dx * TUNING.mouse.sensitivity;
    this.pitch = THREE.MathUtils.clamp(
      this.pitch + dy * TUNING.mouse.sensitivity,
      THREE.MathUtils.degToRad(cam.minPitch),
      THREE.MathUtils.degToRad(cam.maxPitch),
    );
    this.distance = THREE.MathUtils.clamp(this.distance + input.takeWheel() * cam.zoomStep, cam.minDistance, cam.maxDistance);
    this.place(focus, dt);
  }

  private place(focus: THREE.Vector3, dt: number): void {
    const cam = TUNING.camera;
    const wantY = focus.y + cam.lookHeight;
    this.lookY += (wantY - this.lookY) * (dt > 0 ? 1 - Math.exp(-cam.verticalFollow * dt) : 1);
    this.target.set(focus.x, this.lookY, focus.z);

    const cp = Math.cos(this.pitch);
    const dir: [number, number, number] = [Math.sin(this.yaw) * cp, Math.sin(this.pitch), Math.cos(this.yaw) * cp];
    const free = this.world.raycastCamera(this.target.toArray(), dir, this.distance, cam.wallPadding);
    const wanted = Math.max(0.3, Math.min(this.distance, free));
    // Pull in at once so walls never hide the cat; slide back out gently.
    this.current = wanted < this.current
      ? wanted
      : this.current + (wanted - this.current) * (1 - Math.exp(-cam.pullOutSpeed * dt));

    this.camera.position.set(
      this.target.x + dir[0] * this.current,
      this.target.y + dir[1] * this.current,
      this.target.z + dir[2] * this.current,
    );
    this.camera.lookAt(this.target);
  }
}
