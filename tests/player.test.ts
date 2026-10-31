import { describe, expect, it } from 'vitest';
import { NO_INPUT, PlayerController, type MoveIntent } from '../src/player/playerController';
import { TUNING } from '../src/player/tuning';
import { CollisionWorld, type Collider } from '../src/world/collision';

const DT = 1 / 60;
const box = (min: [number, number, number], max: [number, number, number]): Collider => ({ min, max, blocksCamera: true });
const FLOOR = box([-50, -1, -50], [50, 0, 50]);

/** Runs the player for a number of frames. intent(frame) says what is pressed on each frame. */
function run(p: PlayerController, frames: number, intent: (f: number) => Partial<MoveIntent> = () => ({})) {
  let maxY = -Infinity;
  for (let f = 0; f < frames; f++) {
    p.step({ ...NO_INPUT, ...intent(f) }, DT);
    maxY = Math.max(maxY, p.pos[1]);
  }
  return maxY;
}

const settled = (colliders: Collider[], spawn: [number, number, number] = [0, 0, 0]) => {
  const p = new PlayerController(new CollisionWorld(colliders), spawn);
  run(p, 5);
  return p;
};

describe('PlayerController', () => {
  it('falls onto the floor and stands on it', () => {
    const p = new PlayerController(new CollisionWorld([FLOOR]), [0, 3, 0]);
    let landed = false;
    for (let f = 0; f < 120; f++) {
      p.step(NO_INPUT, DT);
      if (p.events.includes('land')) landed = true;
    }
    expect(landed).toBe(true);
    expect(p.onGround).toBe(true);
    expect(p.pos[1]).toBeCloseTo(0, 5);
  });

  it("can't run through a wall", () => {
    const p = settled([FLOOR, box([3, 0, -5], [4, 3, 5])]);
    run(p, 120, () => ({ x: 1 }));
    expect(p.pos[0]).toBeCloseTo(3 - TUNING.player.width / 2, 5);
  });

  it('reaches the full jump height when Space is held', () => {
    const p = settled([FLOOR]);
    const maxY = run(p, 90, (f) => ({ jumpPressed: f === 0, jumpHeld: true }));
    expect(maxY).toBeGreaterThan(TUNING.player.jumpHeight - 0.08);
    expect(maxY).toBeLessThan(TUNING.player.jumpHeight + 0.08);
  });

  it('makes a smaller hop when Space is tapped', () => {
    const p = settled([FLOOR]);
    const maxY = run(p, 90, (f) => ({ jumpPressed: f === 0, jumpHeld: f < 3 }));
    expect(maxY).toBeLessThan(TUNING.player.jumpHeight * 0.6);
  });

  it('double jumps only once per jump and gets it back on landing', () => {
    const p = settled([FLOOR]);
    const presses = new Set([0, 20, 35]);
    let doubles = 0;
    for (let f = 0; f < 150; f++) {
      p.step({ ...NO_INPUT, jumpPressed: presses.has(f), jumpHeld: true }, DT);
      if (p.events.includes('doubleJump')) doubles++;
    }
    expect(doubles).toBe(1);
    expect(p.onGround).toBe(true);
    expect(p.airJumpsLeft).toBe(TUNING.player.airJumps);
  });

  it('can jump just after running off a ledge (coyote time)', () => {
    const p = settled([box([-50, -1, -1], [0.5, 0, 1])], [0, 0, 0]);
    let f = 0;
    while (p.onGround && f++ < 120) p.step({ ...NO_INPUT, x: 1 }, DT);
    expect(p.onGround).toBe(false);
    run(p, 3, () => ({ x: 1 }));
    p.step({ ...NO_INPUT, x: 1, jumpPressed: true, jumpHeld: true }, DT);
    expect(p.events).toContain('jump');
    expect(p.airJumpsLeft).toBe(TUNING.player.airJumps);
  });

  it('jumps on landing if Space was pressed just before (jump buffer)', () => {
    const p = new PlayerController(new CollisionWorld([FLOOR]), [0, 0.5, 0]);
    p.airJumpsLeft = 0; // no double jump, so the press can only be buffered
    let pressFrame = -1;
    let jumped = false;
    for (let f = 0; f < 60; f++) {
      const press = pressFrame < 0 && p.pos[1] < 0.15 && p.vel[1] < 0;
      if (press) pressFrame = f;
      p.step({ ...NO_INPUT, jumpPressed: press, jumpHeld: true }, DT);
      if (p.events.includes('jump')) jumped = true;
    }
    expect(pressFrame).toBeGreaterThanOrEqual(0);
    expect(jumped).toBe(true);
  });

  it('walks up small steps but not tall ones', () => {
    const low = settled([FLOOR, box([1, 0, -5], [10, 0.25, 5])]);
    run(low, 60, () => ({ x: 1 }));
    expect(low.pos[0]).toBeGreaterThan(2);
    expect(low.pos[1]).toBeCloseTo(0.25, 5);

    const high = settled([FLOOR, box([1, 0, -5], [10, 0.5, 5])]);
    run(high, 60, () => ({ x: 1 }));
    expect(high.pos[0]).toBeCloseTo(1 - TUNING.player.width / 2, 5);
  });

  it("doesn't fall through a thin floor at top speed", () => {
    const p = new PlayerController(new CollisionWorld([box([-5, 0, -5], [5, 0.05, 5])]), [0, 40, 0]);
    run(p, 300);
    expect(p.pos[1]).toBeCloseTo(0.05, 5);
  });

  it('goes back to the start after falling out of the level', () => {
    const p = new PlayerController(new CollisionWorld([]), [1, 2, 3]);
    let respawned = false;
    for (let f = 0; f < 300 && !respawned; f++) {
      p.step(NO_INPUT, DT);
      respawned = p.events.includes('respawn');
    }
    expect(respawned).toBe(true);
    expect(p.pos).toEqual([1, 2, 3]);
  });

  describe('what the test level asks for', () => {
    // Run at a ledge, jump about a meter before it, and double jump at the top of the first jump if asked.
    const tryLedge = (height: number, double: boolean) => {
      const p = settled([FLOOR, box([2.5, 0, -5], [40, height, 5])], [-4, 0, 0]);
      let jumpFrame = -1, apex = -1;
      run(p, 200, (f) => {
        const press = jumpFrame < 0 && p.pos[0] > 1.2;
        if (press) jumpFrame = f;
        if (jumpFrame >= 0 && apex < 0 && f > jumpFrame + 1 && p.vel[1] <= 0) apex = f;
        return { x: 1, jumpPressed: press || (double && f === apex), jumpHeld: true };
      });
      return p.onGround && p.pos[1] > height - 0.01;
    };

    it('one jump climbs a 1 m step', () => expect(tryLedge(1.0, false)).toBe(true));
    it('one jump is not enough for a 2.4 m ledge', () => expect(tryLedge(2.4, false)).toBe(false));
    it('a double jump climbs a 2.4 m ledge', () => expect(tryLedge(2.4, true)).toBe(true));

    it('a running jump clears a 3.5 m gap', () => {
      const p = settled([box([-50, -1, -2], [0, 0, 2]), box([3.5, -1, -2], [50, 0, 2])], [-6, 0, 0]);
      let jumped = false;
      run(p, 200, () => {
        const press = !jumped && p.pos[0] > -0.4;
        if (press) jumped = true;
        return { x: 1, jumpPressed: press, jumpHeld: true };
      });
      expect(p.pos[1]).toBeCloseTo(0, 5);
      expect(p.pos[0]).toBeGreaterThan(3.5);
    });
  });
});
