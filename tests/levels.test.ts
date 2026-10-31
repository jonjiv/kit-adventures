import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import { testLevel } from '../scripts/build-levels';
import { levelFromJson } from '../src/world/level';
import { SKY_BARRIER_HEIGHT, validateLevel } from '../src/world/levelFormat';
import { facingFromYaw, PlayerController } from '../src/player/playerController';
import { TUNING } from '../src/player/tuning';

describe('Test Path level', () => {
  const file = testLevel();
  const level = levelFromJson(file);

  it('is valid and matches the saved JSON (run "npm run levels" if this fails)', () => {
    expect(validateLevel(file)).toEqual([]);
    const saved = JSON.parse(readFileSync(new URL('../public/levels/test.json', import.meta.url), 'utf8'));
    expect(saved).toEqual(JSON.parse(JSON.stringify(file)));
  });

  it('starts the cat on solid ground', () => {
    const [x, y, z] = level.start.pos;
    expect(level.collision.groundBelow(x, z, y, 0.3)).toBe(y);
    expect(level.collision.overlapping([x - 0.3, y, z - 0.3], [x + 0.3, y + 0.8, z + 0.3])).toHaveLength(0);
  });

  it('can be finished by a scripted run using only run, jump and double jump', () => {
    const p = new PlayerController(level.collision, level.start.pos, facingFromYaw(0));
    interface Leg {
      to: [number, number];
      jumpWhen: () => boolean;
      double?: boolean;
      /** Stop at the target before the next leg (for small platforms). */
      settle?: boolean;
    }
    const legs: Leg[] = [
      { to: [20, 66], jumpWhen: () => p.pos[2] < 75.3 }, // up onto the deck
      { to: [20, 50], jumpWhen: () => p.pos[2] < 60.7 }, // over the gap
      { to: [18.5, 38], jumpWhen: () => p.pos[2] < 45.4, double: true, settle: true }, // up the ledge
      { to: [18.5, 32.5], jumpWhen: () => p.pos[2] < 36.3, double: true, settle: true }, // stump 1
      { to: [21.5, 28.5], jumpWhen: () => true, double: true, settle: true }, // stump 2
      { to: [18.5, 24.5], jumpWhen: () => true, double: true, settle: true }, // stump 3
      { to: [20, 13], jumpWhen: () => true, double: true, settle: true }, // the golden pad
    ];
    const log: string[] = [];
    for (const [i, leg] of legs.entries()) {
      let jumped = false, doubled = false, done = false;
      for (let f = 0; f < 600 && !done; f++) {
        const dx = leg.to[0] - p.pos[0], dz = leg.to[1] - p.pos[2];
        const dist = Math.hypot(dx, dz);
        const speed = Math.min(TUNING.player.runSpeed, dist * 3);
        const press = (!jumped && p.onGround && leg.jumpWhen()) || (jumped && !doubled && !!leg.double && p.vel[1] <= 0);
        if (press) {
          if (jumped) doubled = true;
          jumped = true;
        }
        p.step({
          x: dist > 0 ? (dx / dist) * (speed / TUNING.player.runSpeed) : 0,
          z: dist > 0 ? (dz / dist) * (speed / TUNING.player.runSpeed) : 0,
          jumpPressed: press, jumpHeld: true,
        }, 1 / 60);
        expect(p.events, `fell during leg ${i + 1}: ${log.join(' ')}`).not.toContain('respawn');
        const landedAfterJump = jumped && p.onGround && f > 5;
        done = leg.settle ? landedAfterJump && dist < 0.35 && Math.hypot(p.vel[0], p.vel[2]) < 0.6 : landedAfterJump;
      }
      log.push(`leg ${i + 1} at ${p.pos.map((v) => v.toFixed(1)).join(',')}`);
      expect(done, `stuck on leg ${i + 1}: ${log.join(' ')}`).toBe(true);
    }
    expect(p.pos[1]).toBeCloseTo(3.6, 1);
  });

  it('has walls up to the sky all around the path, so nothing can be skipped', () => {
    const solidAt = (x: number, y: number, z: number) =>
      level.collision.overlapping([x - 0.01, y - 0.01, z - 0.01], [x + 0.01, y + 0.01, z + 0.01]).length > 0;
    for (let y = -5; y < SKY_BARRIER_HEIGHT; y += 1) {
      for (let z = 7; z <= 93; z += 0.5) {
        expect(solidAt(13, y, z), `left side at y=${y} z=${z}`).toBe(true);
        expect(solidAt(27, y, z), `right side at y=${y} z=${z}`).toBe(true);
      }
      for (let x = 14; x <= 26; x += 0.5) {
        expect(solidAt(x, y, 93), `back at y=${y} x=${x}`).toBe(true);
        expect(solidAt(x, y, 7), `end at y=${y} x=${x}`).toBe(true);
      }
    }
  });
});
