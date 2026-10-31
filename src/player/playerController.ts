// The cat's movement: running, jumping, double jumping and colliding with the
// level. Runs at the fixed physics rate. No Three.js here so it runs in unit tests.
//
// States so far: ground and air. Phase 3 adds wall-run, ledge-hang and dash.

import type { CollisionWorld } from '../world/collision';
import type { Vec3 } from '../world/levelFormat';
import { jumpPhysics, TUNING, type PlayerTuning } from './tuning';

export interface MoveIntent {
  /** Wanted run direction in world space, length 0 to 1. */
  x: number;
  z: number;
  jumpPressed: boolean;
  jumpHeld: boolean;
}

export const NO_INPUT: MoveIntent = { x: 0, z: 0, jumpPressed: false, jumpHeld: false };

export type PlayerState = 'ground' | 'air';
export type PlayerEvent = 'jump' | 'doubleJump' | 'land' | 'respawn';

/** Longest distance moved in one collision check, so fast falls can't pass through thin floors. */
const MAX_MOVE = 0.1;

/** Turns a level yaw (0 = looking toward -Z) into the cat model's facing angle. */
export const facingFromYaw = (yawDegrees: number) => (yawDegrees * Math.PI) / 180 + Math.PI;

export class PlayerController {
  /** Center of the cat's feet. */
  readonly pos: Vec3;
  /** Position at the start of the last step, for smooth drawing between steps. */
  readonly prevPos: Vec3;
  readonly vel: Vec3 = [0, 0, 0];
  /** Angle the cat faces (0 = toward +Z). */
  facing: number;
  prevFacing: number;
  state: PlayerState = 'air';
  airJumpsLeft: number;
  /** How fast the cat was falling when it last landed. */
  landSpeed = 0;
  /** Things that happened this step, for animation and sound. Cleared at the start of each step. */
  readonly events: PlayerEvent[] = [];

  private world: CollisionWorld;
  private t: PlayerTuning;
  private spawn: Vec3;
  private spawnFacing: number;
  private coyote = 0;
  private buffer = 0;
  private canCut = false;

  constructor(world: CollisionWorld, spawn: Vec3, facing = 0, tuning: PlayerTuning = TUNING.player) {
    this.world = world;
    this.t = tuning;
    this.spawn = [...spawn];
    this.spawnFacing = facing;
    this.pos = [...spawn];
    this.prevPos = [...spawn];
    this.facing = this.prevFacing = facing;
    this.airJumpsLeft = tuning.airJumps;
  }

  get onGround(): boolean {
    return this.state === 'ground';
  }

  respawn(): void {
    this.pos.splice(0, 3, ...this.spawn);
    this.prevPos.splice(0, 3, ...this.spawn);
    this.vel.fill(0);
    this.facing = this.prevFacing = this.spawnFacing;
    this.state = 'air';
    this.airJumpsLeft = this.t.airJumps;
    this.coyote = this.buffer = 0;
    this.events.push('respawn');
  }

  step(intent: MoveIntent, dt: number): void {
    const t = this.t;
    const { gravity, jumpSpeed, doubleJumpSpeed } = jumpPhysics(t);
    this.events.length = 0;
    this.prevPos.splice(0, 3, ...this.pos);
    this.prevFacing = this.facing;
    const wasGround = this.onGround;

    this.coyote = wasGround ? t.coyoteTime : Math.max(0, this.coyote - dt);
    this.buffer = intent.jumpPressed ? t.jumpBuffer : Math.max(0, this.buffer - dt);

    // Run: ease the horizontal speed toward where the stick or keys point.
    let ix = intent.x, iz = intent.z;
    const amount = Math.hypot(ix, iz);
    if (amount > 1) { ix /= amount; iz /= amount; }
    const hasInput = amount > 0.01;
    const accel = wasGround ? (hasInput ? t.groundAccel : t.groundDecel) : (hasInput ? t.airAccel : t.airDecel);
    const dvx = ix * t.runSpeed - this.vel[0], dvz = iz * t.runSpeed - this.vel[2];
    const dv = Math.hypot(dvx, dvz), maxDv = accel * dt;
    if (dv <= maxDv) {
      this.vel[0] += dvx;
      this.vel[2] += dvz;
    } else {
      this.vel[0] += (dvx / dv) * maxDv;
      this.vel[2] += (dvz / dv) * maxDv;
    }
    if (hasInput) this.turnToward(Math.atan2(ix, iz), dt);

    // Jump from the ground (or just after leaving it), or double jump in the air.
    if (this.buffer > 0 && (wasGround || this.coyote > 0)) {
      this.vel[1] = jumpSpeed;
      this.buffer = this.coyote = 0;
      this.state = 'air';
      this.canCut = true;
      this.events.push('jump');
    } else if (intent.jumpPressed && !wasGround && this.airJumpsLeft > 0) {
      this.vel[1] = doubleJumpSpeed;
      this.airJumpsLeft--;
      this.buffer = 0;
      this.canCut = true;
      this.events.push('doubleJump');
    }
    if (this.canCut && !intent.jumpHeld && this.vel[1] > 0) {
      this.vel[1] *= t.jumpCutMultiplier;
      this.canCut = false;
    }
    if (this.vel[1] <= 0) this.canCut = false;

    this.vel[1] -= gravity * (this.vel[1] < 0 ? t.fallGravityMultiplier : 1) * dt;
    this.vel[1] = Math.max(this.vel[1], -t.maxFallSpeed);

    // Move one axis at a time in small slices, pushing out of anything solid.
    const dx = this.vel[0] * dt, dy = this.vel[1] * dt, dz = this.vel[2] * dt;
    const slices = Math.max(1, Math.ceil(Math.max(Math.abs(dx), Math.abs(dy), Math.abs(dz)) / MAX_MOVE));
    if (this.state === 'ground') this.state = 'air';
    for (let i = 0; i < slices; i++) {
      this.moveAxis(1, dy / slices, false);
      this.moveAxis(0, dx / slices, wasGround);
      this.moveAxis(2, dz / slices, wasGround);
    }

    if (this.onGround) {
      this.airJumpsLeft = t.airJumps;
      this.canCut = false;
      if (!wasGround) this.events.push('land');
    }
    if (this.pos[1] < t.killHeight) this.respawn();
  }

  private turnToward(target: number, dt: number): void {
    let diff = target - this.facing;
    diff = Math.atan2(Math.sin(diff), Math.cos(diff));
    const maxTurn = ((this.t.turnSpeed * Math.PI) / 180) * dt;
    this.facing += Math.abs(diff) <= maxTurn ? diff : Math.sign(diff) * maxTurn;
  }

  private bounds(): [Vec3, Vec3] {
    const h = this.t.width / 2;
    const [x, y, z] = this.pos;
    return [[x - h, y, z - h], [x + h, y + this.t.height, z + h]];
  }

  private moveAxis(axis: 0 | 1 | 2, d: number, canStep: boolean): void {
    if (d === 0) return;
    this.pos[axis] += d;
    const hits = this.world.overlapping(...this.bounds());
    if (hits.length === 0) return;

    if (axis === 1) {
      if (d < 0) {
        this.pos[1] = Math.max(...hits.map((c) => c.max[1]));
        this.landSpeed = -this.vel[1];
        this.state = 'ground';
      } else {
        this.pos[1] = Math.min(...hits.map((c) => c.min[1])) - this.t.height;
        this.canCut = false;
      }
      this.vel[1] = 0;
      return;
    }

    // Walk straight up small ledges if there's room on top.
    if (canStep) {
      const top = Math.max(...hits.map((c) => c.max[1]));
      const rise = top - this.pos[1];
      if (rise > 0 && rise <= this.t.stepHeight) {
        const oldY = this.pos[1];
        this.pos[1] = top;
        if (this.world.overlapping(...this.bounds()).length === 0) return;
        this.pos[1] = oldY;
      }
    }

    const half = this.t.width / 2;
    this.pos[axis] = d > 0
      ? Math.min(...hits.map((c) => c.min[axis])) - half
      : Math.max(...hits.map((c) => c.max[axis])) + half;
    this.vel[axis] = 0;
  }
}
