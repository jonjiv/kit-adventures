// The cat's movement: running, jumping, double jumping, wall runs, wall jumps,
// ledge grabs and climbs, and dashes, colliding with the level. Runs at the
// fixed physics rate. No Three.js here so it runs in unit tests.
//
// States: ground, air, wallRun, ledge (hanging), climb (pulling up), dash.

import type { CollisionWorld } from '../world/collision';
import type { Vec3 } from '../world/levelFormat';
import { jumpPhysics, TUNING, type PlayerTuning } from './tuning';

export interface MoveIntent {
  /** Wanted run direction in world space, length 0 to 1. */
  x: number;
  z: number;
  jumpPressed: boolean;
  jumpHeld: boolean;
  dashPressed: boolean;
}

export const NO_INPUT: MoveIntent = { x: 0, z: 0, jumpPressed: false, jumpHeld: false, dashPressed: false };

export type PlayerState = 'ground' | 'air' | 'wallRun' | 'ledge' | 'climb' | 'dash';
export type PlayerEvent =
  | 'jump' | 'doubleJump' | 'wallJump' | 'wallRun' | 'wallStep'
  | 'ledgeGrab' | 'climb' | 'dash' | 'land' | 'respawn';

/** Longest distance moved in one collision check, so fast falls can't pass through thin floors. */
const MAX_MOVE = 0.1;
/** How close a wall must be to count as touching. */
const TOUCH = 0.06;
/** The four directions a wall can face (pointing out of the wall). */
const WALL_NORMALS: readonly Vec3[] = [[1, 0, 0], [-1, 0, 0], [0, 0, 1], [0, 0, -1]];

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
  /** The wall the cat is touching, wall-running on or hanging from (pointing out of the wall). */
  wallNormal: Vec3 | null = null;
  /** Things that happened this step, for animation and sound. Cleared at the start of each step. */
  readonly events: PlayerEvent[] = [];

  private world: CollisionWorld;
  private t: PlayerTuning;
  private killY: number;
  private spawn: Vec3;
  private spawnFacing: number;
  private coyote = 0;
  private buffer = 0;
  private canCut = false;

  private lastWall: Vec3 = [1, 0, 0];
  private wallCoyote = 0;
  private wallRunTime = 0;
  private wallRunCooldown = 0;
  private wallRunDir: [number, number] = [0, 0];
  private wallStepTimer = 0;
  private controlLock = 0;

  private ledgeCooldown = 0;
  private hangTime = 0;
  private climbFrom: Vec3 = [0, 0, 0];
  private climbTo: Vec3 = [0, 0, 0];
  private climbT = 0;
  private climbDuration = 1;

  private dashLeft = 0;
  private dashDir: [number, number] = [0, 1];
  private dashCooldown = 0;
  private canAirDash = true;
  private dashFromGround = false;

  constructor(
    world: CollisionWorld, spawn: Vec3, facing = 0,
    tuning: PlayerTuning = TUNING.player, killY: number = tuning.killHeight,
  ) {
    this.world = world;
    this.t = tuning;
    this.killY = killY;
    this.spawn = [...spawn];
    this.spawnFacing = facing;
    this.pos = [...spawn];
    this.prevPos = [...spawn];
    this.facing = this.prevFacing = facing;
    this.airJumpsLeft = tuning.airJumps;
  }

  /** Switches movement numbers (touch play uses more forgiving ones). */
  useTuning(tuning: PlayerTuning): void {
    this.t = tuning;
  }

  get onGround(): boolean {
    return this.state === 'ground';
  }

  /** Where the cat comes back after a fall (a checkpoint). */
  setSpawn(pos: Vec3, facing: number): void {
    this.spawn = [...pos];
    this.spawnFacing = facing;
  }

  respawn(): void {
    this.pos.splice(0, 3, ...this.spawn);
    this.prevPos.splice(0, 3, ...this.spawn);
    this.vel.fill(0);
    this.facing = this.prevFacing = this.spawnFacing;
    this.state = 'air';
    this.airJumpsLeft = this.t.airJumps;
    this.canAirDash = true;
    this.coyote = this.buffer = this.dashLeft = this.controlLock = 0;
    this.wallNormal = null;
    this.events.push('respawn');
  }

  step(intent: MoveIntent, dt: number): void {
    this.events.length = 0;
    this.prevPos.splice(0, 3, ...this.pos);
    this.prevFacing = this.facing;
    for (const k of ['wallCoyote', 'wallRunCooldown', 'controlLock', 'ledgeCooldown', 'dashCooldown'] as const) {
      this[k] = Math.max(0, this[k] - dt);
    }

    if (this.state === 'ledge') this.stepLedge(intent, dt);
    else if (this.state === 'climb') this.stepClimb(dt);
    else if (this.state === 'dash') this.stepDash(intent, dt);
    else this.stepMove(intent, dt);

    if (this.pos[1] < this.killY) this.respawn();
  }

  // ---------------------------------------------------------------- running, jumping, wall runs

  private stepMove(intent: MoveIntent, dt: number): void {
    const t = this.t;
    const { gravity, jumpSpeed, doubleJumpSpeed } = jumpPhysics(t);
    const wasGround = this.onGround;

    this.coyote = wasGround ? t.coyoteTime : Math.max(0, this.coyote - dt);
    this.buffer = intent.jumpPressed ? t.jumpBuffer : Math.max(0, this.buffer - dt);

    const { ix, iz, hasInput } = normalizeIntent(intent);
    const wall = this.touchingWall(ix, iz);
    this.wallNormal = wall;
    const into = wall ? -(ix * wall[0] + iz * wall[2]) : 0;
    if (wall && !wasGround && (this.state === 'wallRun' || this.vel[1] < 0)) {
      // Wall-running or sliding down a wall: a wall jump still works for a moment after letting go.
      this.wallCoyote = t.wallCoyoteTime;
      this.lastWall = wall;
    }
    // Pushing straight into a wall with a double jump left means "go up", not "kick off".
    const headOn = wall !== null && into > t.headOnWall && this.airJumpsLeft > 0 && this.state !== 'wallRun';

    if (intent.dashPressed && (wasGround ? this.dashCooldown <= 0 : this.canAirDash)) {
      this.startDash(ix, iz, hasInput, wasGround);
      return;
    }

    if (this.state !== 'wallRun') {
      let accel = wasGround ? (hasInput ? t.groundAccel : t.groundDecel) : (hasInput ? t.airAccel : t.airDecel);
      if (!wasGround && this.controlLock > 0) accel *= t.wallJumpControl;
      this.accelerate(ix * t.runSpeed, iz * t.runSpeed, accel * dt);
      if (hasInput) this.turnToward(Math.atan2(ix, iz), dt);
    }

    // Jumps: from the ground (or just after leaving it), off a wall, or a double jump.
    if (this.buffer > 0 && (wasGround || this.coyote > 0) && this.state !== 'wallRun') {
      this.vel[1] = jumpSpeed;
      this.buffer = this.coyote = 0;
      this.state = 'air';
      this.canCut = true;
      this.events.push('jump');
    } else if (intent.jumpPressed && !wasGround && !headOn && (this.state === 'wallRun' || wall || this.wallCoyote > 0)) {
      this.wallJump(wall ?? this.lastWall);
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

    // Start a wall run when jumping at a wall at an angle, near the top of the jump.
    if (this.state === 'air' && wall && hasInput && this.wallRunCooldown <= 0 &&
        this.vel[1] <= t.wallRunMaxRiseSpeed && this.vel[1] >= -t.wallRunMaxFallSpeed) {
      const ax = ix - wall[0] * -into, az = iz - wall[2] * -into; // input minus its push into the wall
      const along = Math.hypot(ax, az);
      if (into >= t.wallRunMinInto && along >= t.wallRunMinAlong) {
        this.state = 'wallRun';
        this.wallRunTime = 0;
        this.wallStepTimer = 0;
        this.wallRunDir = [ax / along, az / along];
        this.vel[1] = t.wallRunLift;
        this.lastWall = wall;
        this.airJumpsLeft = t.airJumps;
        this.canAirDash = true;
        this.events.push('wallRun');
      }
    }
    if (this.state === 'wallRun') this.continueWallRun(wall, into, dt);

    let g = gravity * (this.vel[1] < 0 ? t.fallGravityMultiplier : 1);
    if (this.state === 'wallRun') g = gravity * t.wallRunGravity;
    this.vel[1] = Math.max(this.vel[1] - g * dt, -t.maxFallSpeed);
    if (this.state === 'air' && wall && into > 0.3 && this.vel[1] < -t.wallSlideSpeed) this.vel[1] = -t.wallSlideSpeed;

    if (this.state === 'ground') this.state = 'air';
    this.move(dt, wasGround);

    if (this.onGround) {
      this.airJumpsLeft = t.airJumps;
      this.canAirDash = true;
      this.canCut = false;
      if (!wasGround) this.events.push('land');
      if (wall && into > 0.6) this.tryClimb(wall);
    } else if (this.vel[1] <= 0 && this.ledgeCooldown <= 0) {
      this.tryLedgeGrab(ix, iz);
    }
  }

  private continueWallRun(wall: Vec3 | null, into: number, dt: number): void {
    const t = this.t;
    this.wallRunTime += dt;
    const sameWall = wall && wall[0] === this.lastWall[0] && wall[2] === this.lastWall[2];
    if (!wall || !sameWall || this.wallRunTime > t.wallRunTime || into < 0.05) {
      this.state = 'air';
      this.wallRunCooldown = t.wallRunCooldown;
      return;
    }
    const [dx, dz] = this.wallRunDir;
    const speed = Math.max(t.wallRunSpeed, this.vel[0] * dx + this.vel[2] * dz);
    this.vel[0] = dx * speed - wall[0] * 0.5;
    this.vel[2] = dz * speed - wall[2] * 0.5;
    this.facing = Math.atan2(dx, dz);
    this.wallStepTimer -= dt;
    if (this.wallStepTimer <= 0) {
      this.wallStepTimer = t.wallStepInterval;
      this.events.push('wallStep');
    }
  }

  private wallJump(n: Vec3): void {
    const t = this.t;
    const along = this.vel[0] * n[2] * -1 + this.vel[2] * n[0]; // speed along the wall
    const tx = -n[2], tz = n[0]; // a direction along the wall
    this.vel[0] = n[0] * t.wallJumpPush + tx * along * t.wallJumpKeep;
    this.vel[2] = n[2] * t.wallJumpPush + tz * along * t.wallJumpKeep;
    this.vel[1] = jumpPhysics(t).wallJumpSpeed;
    this.facing = Math.atan2(this.vel[0], this.vel[2]);
    this.state = 'air';
    this.controlLock = t.wallJumpLockTime;
    this.wallRunCooldown = 0;
    this.wallCoyote = this.buffer = 0;
    this.canCut = true;
    this.airJumpsLeft = t.airJumps;
    this.canAirDash = true;
    this.events.push('wallJump');
  }

  // ---------------------------------------------------------------- ledges and climbing

  /** Grabs a ledge in front of the cat's paws, if there is room to climb onto it. */
  private tryLedgeGrab(ix: number, iz: number): void {
    const t = this.t;
    for (const n of WALL_NORMALS) {
      if (ix * n[0] + iz * n[2] > 0.3) continue; // pushing away from this wall
      const top = this.ledgeTop(n, t.ledgeMinHeight, t.height + t.ledgeReach);
      if (top === null) continue;
      const hangY = top - t.ledgeHangDrop;
      const h = t.width / 2;
      const [x, , z] = this.pos;
      // Room to hang and pull straight up, then room to stand on top.
      if (this.world.overlapping([x - h, hangY, z - h], [x + h, top + t.height, z + h]).length > 0) continue;
      const stand = this.standSpot(n, top);
      if (!stand) continue;
      this.pos[1] = hangY;
      this.vel.fill(0);
      this.state = 'ledge';
      this.wallNormal = n;
      this.climbTo = stand;
      this.hangTime = 0;
      this.facing = Math.atan2(-n[0], -n[2]);
      this.airJumpsLeft = t.airJumps;
      this.canAirDash = true;
      this.events.push('ledgeGrab');
      return;
    }
  }

  private stepLedge(intent: MoveIntent, dt: number): void {
    const t = this.t;
    const n = this.wallNormal!;
    this.hangTime += dt;
    const { ix, iz } = normalizeIntent(intent);
    const into = -(ix * n[0] + iz * n[2]);
    if (intent.jumpPressed || (into > 0.5 && this.hangTime >= t.ledgeMinHang)) {
      this.startClimb(this.climbTo, t.climbTime);
    } else if (into < -0.5) {
      this.state = 'air';
      this.ledgeCooldown = t.ledgeRegrabDelay;
      this.vel[0] = n[0] * 1.5;
      this.vel[2] = n[2] * 1.5;
      this.wallNormal = null;
    }
  }

  /** Climbs walls up to autoClimbHeight when running into them. */
  private tryClimb(n: Vec3): void {
    const t = this.t;
    const top = this.ledgeTop(n, t.stepHeight + 0.01, t.autoClimbHeight);
    if (top === null) return;
    const h = t.width / 2;
    const [x, y, z] = this.pos;
    if (this.world.overlapping([x - h, y, z - h], [x + h, top + t.height, z + h]).length > 0) return;
    const stand = this.standSpot(n, top);
    if (stand) this.startClimb(stand, t.autoClimbTime);
  }

  /**
   * Height of the top of the grippy wall on side n, if that top is between
   * `low` and `high` above the feet. null if there's no wall or it's taller.
   */
  private ledgeTop(n: Vec3, low: number, high: number): number | null {
    const h = this.t.width / 2;
    const [x, y, z] = this.pos;
    const sx = -n[0] * TOUCH * 1.5, sz = -n[2] * TOUCH * 1.5;
    const hits = this.world.overlapping(
      [x - h + sx, y + low, z - h + sz], [x + h + sx, y + high + 0.5, z + h + sz],
    );
    if (hits.length === 0 || hits.some((c) => !c.grip)) return null;
    const top = Math.max(...hits.map((c) => c.max[1]));
    return top <= y + high && top >= y + low ? top : null;
  }

  /** A clear place to stand on top of the ledge on side n, or null. */
  private standSpot(n: Vec3, top: number): Vec3 | null {
    const t = this.t;
    const h = t.width / 2;
    const reach = t.width + 0.1;
    const x = this.pos[0] - n[0] * reach, z = this.pos[2] - n[2] * reach;
    if (this.world.overlapping([x - h, top + 0.01, z - h], [x + h, top + t.height, z + h]).length > 0) return null;
    return [x, top, z];
  }

  private startClimb(to: Vec3, duration: number): void {
    this.climbFrom = [...this.pos];
    this.climbTo = [...to];
    this.climbT = 0;
    this.climbDuration = duration;
    this.vel.fill(0);
    this.state = 'climb';
    this.events.push('climb');
  }

  private stepClimb(dt: number): void {
    this.climbT = Math.min(1, this.climbT + dt / this.climbDuration);
    const u = this.climbT, a = this.climbFrom, b = this.climbTo;
    // Up first, then forward onto the top.
    const up = Math.min(1, u / 0.6), across = Math.max(0, (u - 0.6) / 0.4);
    this.pos[1] = a[1] + (b[1] - a[1]) * up;
    this.pos[0] = a[0] + (b[0] - a[0]) * across;
    this.pos[2] = a[2] + (b[2] - a[2]) * across;
    if (u >= 1) {
      this.state = 'ground';
      this.wallNormal = null;
    }
  }

  // ---------------------------------------------------------------- dash

  private startDash(ix: number, iz: number, hasInput: boolean, fromGround: boolean): void {
    const t = this.t;
    const dx = hasInput ? ix : Math.sin(this.facing), dz = hasInput ? iz : Math.cos(this.facing);
    const len = Math.hypot(dx, dz) || 1;
    this.dashDir = [dx / len, dz / len];
    this.dashLeft = t.dashTime;
    this.dashFromGround = fromGround;
    if (!fromGround) this.canAirDash = false;
    this.dashCooldown = t.dashCooldown;
    this.facing = Math.atan2(this.dashDir[0], this.dashDir[1]);
    this.state = 'dash';
    this.vel[0] = this.dashDir[0] * t.dashSpeed;
    this.vel[2] = this.dashDir[1] * t.dashSpeed;
    this.vel[1] = 0;
    this.wallNormal = null;
    this.events.push('dash');
  }

  private stepDash(intent: MoveIntent, dt: number): void {
    const t = this.t;
    if (intent.jumpPressed) this.buffer = t.jumpBuffer;
    this.dashLeft -= dt;
    this.vel[1] = 0;
    this.move(dt, this.dashFromGround);
    const blocked = Math.hypot(this.vel[0], this.vel[2]) < t.dashSpeed * 0.5;
    if (this.dashLeft > 0 && !blocked) return;

    const keep = blocked ? 0 : t.dashExitSpeed;
    this.vel[0] = this.dashDir[0] * keep;
    this.vel[2] = this.dashDir[1] * keep;
    const h = t.width / 2;
    const [x, y, z] = this.pos;
    const supported = this.world.overlapping([x - h, y - 0.05, z - h], [x + h, y, z + h]).length > 0;
    this.state = supported ? 'ground' : 'air';
    if (this.dashFromGround) this.coyote = t.coyoteTime;
  }

  // ---------------------------------------------------------------- helpers

  /** The grippy wall the cat touches, preferring the one it pushes into. */
  private touchingWall(ix: number, iz: number): Vec3 | null {
    const h = this.t.width / 2;
    const [x, y, z] = this.pos;
    let best: Vec3 | null = null, bestPush = -Infinity;
    for (const n of WALL_NORMALS) {
      const sx = -n[0] * TOUCH, sz = -n[2] * TOUCH;
      const hits = this.world.overlapping(
        [x - h + sx, y + 0.15, z - h + sz], [x + h + sx, y + this.t.height - 0.15, z + h + sz],
      );
      if (!hits.some((c) => c.grip && c.max[1] > y + 0.4)) continue;
      const push = -(ix * n[0] + iz * n[2]);
      if (push > bestPush) {
        best = n;
        bestPush = push;
      }
    }
    return best;
  }

  private accelerate(tx: number, tz: number, maxDv: number): void {
    const dvx = tx - this.vel[0], dvz = tz - this.vel[2];
    const dv = Math.hypot(dvx, dvz);
    if (dv <= maxDv) {
      this.vel[0] += dvx;
      this.vel[2] += dvz;
    } else {
      this.vel[0] += (dvx / dv) * maxDv;
      this.vel[2] += (dvz / dv) * maxDv;
    }
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

  /** Moves by the current velocity one axis at a time in small slices, pushing out of anything solid. */
  private move(dt: number, canStep: boolean): void {
    const dx = this.vel[0] * dt, dy = this.vel[1] * dt, dz = this.vel[2] * dt;
    const slices = Math.max(1, Math.ceil(Math.max(Math.abs(dx), Math.abs(dy), Math.abs(dz)) / MAX_MOVE));
    for (let i = 0; i < slices; i++) {
      this.moveAxis(1, dy / slices, false);
      this.moveAxis(0, dx / slices, canStep);
      this.moveAxis(2, dz / slices, canStep);
    }
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
        if (this.state !== 'dash') this.state = 'ground';
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

function normalizeIntent(intent: MoveIntent) {
  let ix = intent.x, iz = intent.z;
  const amount = Math.hypot(ix, iz);
  if (amount > 1) { ix /= amount; iz /= amount; }
  return { ix, iz, hasInput: amount > 0.01 };
}
