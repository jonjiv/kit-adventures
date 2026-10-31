/** Runs a fixed-size physics step however fast the screen redraws. */
export class FixedStepper {
  readonly step: number;
  private maxFrame: number;
  private acc = 0;

  constructor(hz: number, maxFrame: number) {
    this.step = 1 / hz;
    this.maxFrame = maxFrame;
  }

  /** Runs as many steps as fit in the elapsed time. Returns how far into the next step we are (0 to 1). */
  advance(dt: number, update: (step: number) => void): number {
    this.acc += Math.min(Math.max(dt, 0), this.maxFrame);
    while (this.acc >= this.step) {
      update(this.step);
      this.acc -= this.step;
    }
    return this.acc / this.step;
  }
}

export function runLoop(
  stepper: FixedStepper,
  update: (step: number) => void,
  render: (alpha: number, frameDt: number) => void,
): void {
  let last = performance.now();
  const frame = (now: number) => {
    const dt = (now - last) / 1000;
    last = now;
    const alpha = stepper.advance(dt, update);
    render(alpha, dt);
    requestAnimationFrame(frame);
  };
  requestAnimationFrame(frame);
}
