import { describe, expect, it } from 'vitest';
import { FixedStepper } from '../src/engine/loop';

describe('FixedStepper', () => {
  it('runs whole steps and reports the leftover fraction', () => {
    const s = new FixedStepper(10, 1);
    let steps = 0;
    const alpha = s.advance(0.25, () => steps++);
    expect(steps).toBe(2);
    expect(alpha).toBeCloseTo(0.5);
    s.advance(0.06, () => steps++);
    expect(steps).toBe(3);
  });

  it('does not step at all on a very short frame', () => {
    const s = new FixedStepper(60, 0.25);
    let steps = 0;
    s.advance(0.005, () => steps++);
    expect(steps).toBe(0);
  });

  it('caps how much time it catches up after a long pause', () => {
    const s = new FixedStepper(60, 0.25);
    let steps = 0;
    s.advance(10, () => steps++);
    expect(steps).toBe(15);
  });
});
