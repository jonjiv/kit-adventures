import { beforeAll, describe, expect, it } from 'vitest';
import { OBSTACLE as O } from '../scripts/obstacles';
import { NO_INPUT, PlayerController, type MoveIntent } from '../src/player/playerController';
import { TOUCH_PLAYER, TUNING, type PlayerTuning } from '../src/player/tuning';
import { CollisionWorld, type Collider } from '../src/world/collision';
import type { Vec3 } from '../src/world/levelFormat';

const DT = 1 / 60;
const HALF = TUNING.player.width / 2;
const box = (min: Vec3, max: Vec3, grip = true): Collider => ({ min, max, blocksCamera: true, grip });
const FLOOR = box([-50, -1, -50], [50, 0, 50]);

/** Movement numbers the test cat uses (keyboard or the more forgiving touch ones). */
let tuning: PlayerTuning = TUNING.player;

/** Floor before x = 0 and after x = gap, with nothing between. */
const pit = (gap: number) => [box([-50, -1, -5], [0, 0, 5]), box([gap, -1, -5], [gap + 50, 0, 5])];

interface Run { p: PlayerController; fell: boolean; maxY: number; events: Set<string> }

/** Plays the cat for some frames. `ctl` says what is pressed each frame. Falling below y = -5 counts as a fall. */
function play(colliders: Collider[], spawn: Vec3, frames: number, ctl: (p: PlayerController, f: number) => Partial<MoveIntent> = () => ({})): Run {
  const p = new PlayerController(new CollisionWorld(colliders), spawn, 0, tuning, -5);
  const run: Run = { p, fell: false, maxY: -Infinity, events: new Set() };
  for (let f = 0; f < frames && !run.fell; f++) {
    p.step({ ...NO_INPUT, ...ctl(p, f) }, DT);
    p.events.forEach((e) => run.events.add(e));
    run.fell = p.events.includes('respawn');
    run.maxY = Math.max(run.maxY, p.pos[1]);
  }
  return run;
}

/** Runs toward +x from x = -6 and jumps at `jumpAt`. Optionally double jumps at the top and dashes at the top of that. */
function longJump(colliders: Collider[], jumpAt: number, opts: { double?: boolean; dash?: boolean } = {}): Run {
  let jumped = -1, doubled = -1, dashed = false;
  return play(colliders, [-6, 0, 0], 300, (p, f) => {
    const i: Partial<MoveIntent> = { x: 1, jumpHeld: true };
    if (jumped < 0 && p.onGround && p.pos[0] > jumpAt) { jumped = f; i.jumpPressed = true; }
    else if (opts.double && jumped >= 0 && doubled < 0 && f > jumped + 2 && p.vel[1] <= 0) { doubled = f; i.jumpPressed = true; }
    else if (opts.dash && doubled >= 0 && !dashed && f > doubled + 2 && p.vel[1] <= 0) { dashed = true; i.dashPressed = true; }
    return i;
  });
}

const landedPast = (r: Run, x: number, y = 0) => !r.fell && r.p.onGround && r.p.pos[0] > x && Math.abs(r.p.pos[1] - y) < 0.01;

describe('basic movement', () => {
  it('falls onto the floor and stands on it', () => {
    const r = play([FLOOR], [0, 3, 0], 120);
    expect(r.events.has('land')).toBe(true);
    expect(r.p.onGround).toBe(true);
    expect(r.p.pos[1]).toBeCloseTo(0, 5);
  });

  it("can't run through a wall", () => {
    const r = play([FLOOR, box([3, 0, -5], [4, 3, 5])], [0, 0, 0], 120, () => ({ x: 1 }));
    expect(r.p.pos[0]).toBeCloseTo(3 - HALF, 5);
  });

  it('reaches the full jump height when Space is held, and hops lower when tapped', () => {
    const full = play([FLOOR], [0, 0, 0], 90, (_, f) => ({ jumpPressed: f === 1, jumpHeld: true }));
    expect(full.maxY).toBeGreaterThan(TUNING.player.jumpHeight - 0.08);
    expect(full.maxY).toBeLessThan(TUNING.player.jumpHeight + 0.08);
    const tap = play([FLOOR], [0, 0, 0], 90, (_, f) => ({ jumpPressed: f === 1, jumpHeld: f < 4 }));
    expect(tap.maxY).toBeLessThan(TUNING.player.jumpHeight * 0.6);
  });

  it('double jumps only once per jump and gets it back on landing', () => {
    let doubles = 0;
    const presses = new Set([1, 20, 35]);
    const r = play([FLOOR], [0, 0, 0], 150, (p, f) => {
      if (p.events.includes('doubleJump')) doubles++;
      return { jumpPressed: presses.has(f), jumpHeld: true };
    });
    expect(doubles).toBe(1);
    expect(r.p.airJumpsLeft).toBe(TUNING.player.airJumps);
  });

  it('can jump just after running off a ledge (coyote time)', () => {
    let leftAt = -1, jumped = false;
    play([box([-50, -1, -1], [0.5, 0, 1])], [0, 0, 0], 60, (p, f) => {
      if (leftAt < 0 && !p.onGround && f > 2) leftAt = f;
      if (p.events.includes('jump')) jumped = true;
      return { x: 1, jumpPressed: leftAt >= 0 && f === leftAt + 4, jumpHeld: true };
    });
    expect(jumped).toBe(true);
  });

  it('jumps on landing if Space was pressed just before (jump buffer)', () => {
    let pressed = false, jumped = false;
    const p = new PlayerController(new CollisionWorld([FLOOR]), [0, 0.5, 0]);
    p.airJumpsLeft = 0; // no double jump, so the press can only be buffered
    for (let f = 0; f < 60; f++) {
      const press = !pressed && p.pos[1] < 0.15 && p.vel[1] < 0;
      if (press) pressed = true;
      p.step({ ...NO_INPUT, jumpPressed: press, jumpHeld: true }, DT);
      if (p.events.includes('jump')) jumped = true;
    }
    expect(jumped).toBe(true);
  });

  it('walks up small steps but not tall ones', () => {
    const low = play([FLOOR, box([1, 0, -5], [10, 0.25, 5])], [0, 0, 0], 60, () => ({ x: 1 }));
    expect(low.p.pos[1]).toBeCloseTo(0.25, 5);
    const high = play([FLOOR, box([1, 0, -5], [10, 1.3, 5])], [0, 0, 0], 120, () => ({ x: 1 }));
    expect(high.p.pos[0]).toBeCloseTo(1 - HALF, 5);
  });

  it("doesn't fall through a thin floor at top speed", () => {
    const r = play([box([-5, 0, -5], [5, 0.05, 5])], [0, 40, 0], 300);
    expect(r.p.pos[1]).toBeCloseTo(0.05, 5);
  });

  it('comes back to the checkpoint after falling out of the level', () => {
    const p = new PlayerController(new CollisionWorld([]), [1, 2, 3], 0, TUNING.player, -5);
    p.setSpawn([7, 8, 9], 1);
    let respawned = false;
    for (let f = 0; f < 300 && !respawned; f++) {
      p.step(NO_INPUT, DT);
      respawned = p.events.includes('respawn');
    }
    expect(p.pos).toEqual([7, 8, 9]);
    expect(p.facing).toBe(1);
  });
});

describe('parkour moves', () => {
  it('climbs low walls automatically when running into them', () => {
    const r = play([FLOOR, box([2, 0, -5], [20, 1, 5])], [0, 0, 0], 90, () => ({ x: 1 }));
    expect(r.events.has('climb')).toBe(true);
    expect(r.p.pos[1]).toBeCloseTo(1, 5);
    expect(r.p.pos[0]).toBeGreaterThan(2.3);
  });

  it('dashes once in the air and on the ground only after a cooldown', () => {
    let dashes = 0;
    play([FLOOR], [0, 0, 0], 40, (p, f) => {
      if (p.events.includes('dash')) dashes++;
      return { x: 1, dashPressed: f === 1 || f === 5 };
    });
    expect(dashes).toBe(1);

    let airDashes = 0;
    play([FLOOR], [0, 0, 0], 60, (p, f) => {
      if (p.events.includes('dash')) airDashes++;
      return { x: 1, jumpPressed: f === 1, jumpHeld: true, dashPressed: f === 10 || f === 25 };
    });
    expect(airDashes).toBe(1);
  });

  it('wall jumps away from a wall and gets the double jump back', () => {
    const wall = box([1, 0, -5], [2, 6, 5]);
    let wallJumped = false;
    const r = play([FLOOR, wall], [0, 0, 0], 60, (p, f) => {
      if (p.events.includes('wallJump')) wallJumped = true;
      const touching = p.wallNormal !== null && !p.onGround;
      return {
        x: f < 30 ? 1 : 0,
        jumpPressed: f === 1 || f === 15 || (touching && !wallJumped && f > 18),
        jumpHeld: true,
      };
    });
    expect(wallJumped).toBe(true);
    expect(r.p.vel[0] < 0 || r.p.pos[0] < 1 - HALF - 0.5).toBe(true);
  });

  it("can't wall-run, wall-jump or grab bushy hedges", () => {
    const hedge = box([1, 0, -5], [2, 6, 5], false);
    const r = play([FLOOR, hedge], [0, 0, 0], 60, (_, f) => ({ x: 0.8, z: 0.6, jumpPressed: f === 1 || f === 20, jumpHeld: true }));
    expect(r.events.has('wallRun')).toBe(false);
    expect(r.events.has('wallJump')).toBe(false);
    expect(r.events.has('ledgeGrab')).toBe(false);
  });

  it('lets go of a ledge when pulling away', () => {
    let grabbed = false;
    const r = play([FLOOR, box([1.5, 0, -5], [20, O.ledgeGrab, 5])], [0, 0, 0], 200, (p, f) => {
      if (p.state === 'ledge') grabbed = true;
      const i: Partial<MoveIntent> = { x: grabbed ? -1 : 1, jumpHeld: true };
      if (f === 1 || (f > 3 && !grabbed && p.vel[1] <= 0 && p.airJumpsLeft > 0)) i.jumpPressed = true;
      return i;
    });
    expect(grabbed).toBe(true);
    expect(r.p.pos[1]).toBeCloseTo(0, 5);
  });
});

// Touch play has more forgiving timings, so every obstacle is checked with both sets of numbers.
describe.each([['keyboard', TUNING.player], ['touch', TOUCH_PLAYER]] as const)('every obstacle needs its move, and the move is enough (%s)', (_name, numbers) => {
  beforeAll(() => {
    tuning = numbers;
    return () => { tuning = TUNING.player; };
  });

  it(`hurdles (${O.hurdle} m): too tall to walk or climb, easy to jump`, () => {
    const hurdle = box([2, 0, -5], [2.5, O.hurdle, 5]);
    expect(play([FLOOR, hurdle], [0, 0, 0], 120, () => ({ x: 1 })).p.pos[0]).toBeLessThan(2);
    expect(longJump([FLOOR, hurdle], 0.8).p.pos[0]).toBeGreaterThan(2.5);
  });

  it(`a ${O.jumpUp} m step needs a jump`, () => {
    const step = box([2.5, 0, -5], [40, O.jumpUp, 5]);
    expect(play([FLOOR, step], [0, 0, 0], 120, () => ({ x: 1 })).p.pos[1]).toBe(0);
    expect(landedPast(longJump([FLOOR, step], 1.2), 2.5, O.jumpUp)).toBe(true);
  });

  it(`a ${O.ledgeDouble} m ledge is too high for one jump: double jump onto it, or jump and grab it`, () => {
    const ledge = box([2.5, 0, -5], [40, O.ledgeDouble, 5]);
    expect(TUNING.player.jumpHeight).toBeLessThan(O.ledgeDouble);
    const double = longJump([FLOOR, ledge], 1.2, { double: true });
    expect(landedPast(double, 2.5, O.ledgeDouble)).toBe(true);
    const grab = longJump([FLOOR, ledge], 1.2);
    expect(grab.events.has('ledgeGrab')).toBe(true);
    expect(landedPast(grab, 2.5, O.ledgeDouble)).toBe(true);
  });

  it(`a ${O.ledgeGrab} m ledge is too high to land on, but a double jump grabs it`, () => {
    const ledge = box([2.5, 0, -5], [40, O.ledgeGrab, 5]);
    const r = longJump([FLOOR, ledge], 1.2, { double: true });
    expect(r.events.has('ledgeGrab')).toBe(true);
    expect(landedPast(r, 2.5, O.ledgeGrab)).toBe(true);
    // Highest the feet ever get without help from a ledge:
    expect(TUNING.player.jumpHeight + TUNING.player.doubleJumpHeight).toBeLessThan(O.ledgeGrab);
  });

  it(`a ${O.tallWall} m wall can't be grabbed or climbed`, () => {
    const wall = box([2.5, 0, -5], [40, O.tallWall, 5]);
    const r = longJump([FLOOR, wall], 1.2, { double: true });
    expect(r.events.has('ledgeGrab')).toBe(false);
    expect(r.p.pos[1]).toBe(0);
  });

  it(`a ${O.gapJump} m gap needs only a running jump`, () => {
    expect(landedPast(longJump(pit(O.gapJump), -0.4), O.gapJump)).toBe(true);
  });

  it(`a ${O.gapDouble} m gap needs a double jump`, () => {
    expect(landedPast(longJump(pit(O.gapDouble), -0.4), O.gapDouble)).toBe(false);
    expect(landedPast(longJump(pit(O.gapDouble), -0.4, { double: true }), O.gapDouble)).toBe(true);
  });

  it(`a ${O.gapDash} m gap needs a double jump and a dash`, () => {
    expect(landedPast(longJump(pit(O.gapDash), -0.4, { double: true }), O.gapDash)).toBe(false);
    expect(landedPast(longJump(pit(O.gapDash), -0.4, { double: true, dash: true }), O.gapDash)).toBe(true);
  });

  it(`a ${O.wallRunPit} m pit can't be crossed without the wall, but a wall run does it`, () => {
    // Even the longest jump (double jump and dash) falls short.
    expect(landedPast(longJump(pit(O.wallRunPit), -0.4, { double: true, dash: true }), O.wallRunPit)).toBe(false);

    const wall = box([-8, 0, -5], [O.wallRunPit + 2, O.tallWall, -4]);
    let jumped = false;
    const r = play([...pit(O.wallRunPit), wall], [-6, 0, -3.5], 300, (p) => {
      if (p.onGround && p.pos[0] > O.wallRunPit) return {}; // made it: let go
      const press = !jumped && p.onGround && p.pos[0] > -0.6;
      if (press) jumped = true;
      return { x: 0.85, z: -0.5, jumpPressed: press, jumpHeld: true };
    });
    expect(r.events.has('wallRun')).toBe(true);
    expect(landedPast(r, O.wallRunPit)).toBe(true);
  });

  it(`a ${O.chimneyGap} m chimney can be climbed ${O.chimneyHeight} m with wall jumps`, () => {
    const c = O.chimneyGap / 2, top = O.chimneyHeight;
    const walls = [
      FLOOR,
      box([-5, 0, -5], [-c, top, 5]), box([c, 0, -5], [5, top, 5]), // the slot's sides
      box([-c, 0, -5], [c, top, -1], false), // the back of the slot is a hedge (no grip)
    ];
    let toward = 1;
    const r = play(walls, [0, 0, 0], 600, (p, f) => {
      const n = p.wallNormal;
      const kick = !p.onGround && n !== null && n[0] !== 0 && p.vel[1] < 1;
      if (kick) toward = n[0];
      if (p.onGround && p.pos[1] > 1) return {}; // made it to the top: let go
      return { x: toward * 0.7, jumpPressed: f === 1 || kick, jumpHeld: true };
    });
    expect(r.events.has('wallJump')).toBe(true);
    expect(r.p.onGround).toBe(true);
    expect(r.p.pos[1]).toBeCloseTo(top, 5);
  });

  it('the double wall run: run one wall, wall-jump across, run the other', () => {
    // Same shape as doubleWallRun() in build-levels.ts, turned so forward is +x and left is -z.
    const walls = [
      box([-50, -1, -5], [4, 0, 5]), box([20, -1, -5], [70, 0, 5]),
      box([3, 0, -2.5], [12.5, O.tallWall, -1.5]),
      box([10.5, 0, 1.5], [21, O.tallWall, 2.5]),
    ];
    let jumped = false, kicked = false;
    const r = play(walls, [3.1, 0, -1.15], 400, (p, f) => {
      if (f < 3) return {}; // settle on the floor first
      if (p.onGround && p.pos[0] > 20) return {}; // made it: let go
      if (!jumped) {
        const press = p.onGround && p.pos[0] > 3.15;
        if (press) jumped = true;
        return { x: 0.8, z: -0.6, jumpPressed: press, jumpHeld: true };
      }
      if (!kicked) {
        const kick = p.state === 'wallRun' && p.pos[0] > 10.6;
        if (kick) kicked = true;
        return { x: 0.8, z: kick ? 0.6 : -0.6, jumpPressed: kick, jumpHeld: true };
      }
      return { x: 0.8, z: 0.6, jumpHeld: true };
    });
    expect(kicked).toBe(true);
    expect(landedPast(r, 20)).toBe(true);
  });
});
