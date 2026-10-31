import { describe, expect, it } from 'vitest';
import { stickFromOffset } from '../src/engine/touchControls';
import { TOUCH_PLAYER, TUNING } from '../src/player/tuning';

const R = 60;

describe('joystick', () => {
  it('ignores small wiggles in the middle', () => {
    const s = stickFromOffset(R * TUNING.touch.stickDeadZone * 0.9, 0, R);
    expect(Math.hypot(s.x, s.y)).toBe(0);
  });

  it('pushing up means forward, right means right', () => {
    const up = stickFromOffset(0, -R, R);
    expect(up.y).toBeCloseTo(1);
    expect(up.x).toBeCloseTo(0);
    const right = stickFromOffset(R, 0, R);
    expect(right.x).toBeCloseTo(1);
    expect(right.y).toBeCloseTo(0);
  });

  it('is fully pushed before the edge, and never more than full', () => {
    const near = stickFromOffset(0, R * TUNING.touch.stickFullAt, R);
    expect(near.y).toBeCloseTo(-1);
    const far = stickFromOffset(R * 3, R * 3, R);
    expect(Math.hypot(far.x, far.y)).toBeCloseTo(1);
  });

  it('a half push walks at part speed in the same direction', () => {
    const s = stickFromOffset(R * 0.3, -R * 0.3, R);
    const len = Math.hypot(s.x, s.y);
    expect(len).toBeGreaterThan(0.3);
    expect(len).toBeLessThan(1);
    expect(s.x).toBeCloseTo(s.y); // up and to the right
  });
});

describe('touch tuning', () => {
  it('is more forgiving than the keyboard and changes nothing else', () => {
    expect(TOUCH_PLAYER.coyoteTime).toBe(0.18);
    expect(TOUCH_PLAYER.jumpBuffer).toBe(0.18);
    expect(TOUCH_PLAYER.wallRunMinInto).toBeLessThan(TUNING.player.wallRunMinInto);
    expect(TOUCH_PLAYER.wallRunMinAlong).toBeLessThan(TUNING.player.wallRunMinAlong);
    const changed = Object.keys(TUNING.touch.player);
    for (const [k, v] of Object.entries(TUNING.player)) {
      if (!changed.includes(k)) expect(TOUCH_PLAYER[k as keyof typeof TOUCH_PLAYER]).toBe(v);
    }
  });

  it('buttons are big enough for small thumbs at every size', () => {
    const t = TUNING.touch;
    for (const scale of Object.values(t.sizeScale)) {
      expect(t.jumpButtonSize * scale).toBeGreaterThanOrEqual(72);
      expect(t.dashButtonSize * scale).toBeGreaterThanOrEqual(72);
    }
  });
});
