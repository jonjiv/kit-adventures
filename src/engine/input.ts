// Keyboard and mouse input. Keys use KeyboardEvent.code so they work on any keyboard layout.

const BLOCK_DEFAULT = new Set(['Space', 'ArrowUp', 'ArrowDown', 'ArrowLeft', 'ArrowRight', 'Tab']);

export class Input {
  private canvas: HTMLElement;
  private down = new Set<string>();
  private pressed = new Set<string>();
  private dx = 0;
  private dy = 0;
  private wheel = 0;

  constructor(canvas: HTMLElement) {
    this.canvas = canvas;
    window.addEventListener('keydown', (e) => {
      if (BLOCK_DEFAULT.has(e.code)) e.preventDefault();
      if (!e.repeat) this.pressed.add(e.code);
      this.down.add(e.code);
    });
    window.addEventListener('keyup', (e) => this.down.delete(e.code));
    window.addEventListener('blur', () => this.down.clear());
    window.addEventListener('mousemove', (e) => {
      if (!this.pointerLocked) return;
      this.dx += e.movementX;
      this.dy += e.movementY;
    });
    canvas.addEventListener('wheel', (e) => {
      e.preventDefault();
      this.wheel += Math.sign(e.deltaY);
    }, { passive: false });
    canvas.addEventListener('click', () => this.lockPointer());
  }

  get pointerLocked(): boolean {
    return document.pointerLockElement === this.canvas;
  }

  lockPointer(): void {
    if (this.pointerLocked) return;
    // Some browsers return a promise that rejects if the request is too soon after Esc.
    const result = this.canvas.requestPointerLock() as unknown as Promise<void> | undefined;
    result?.catch?.(() => {});
  }

  isDown(code: string): boolean {
    return this.down.has(code);
  }

  /** True if the key went down since the last physics step. */
  wasPressed(code: string): boolean {
    return this.pressed.has(code);
  }

  /** Call after every physics step. */
  endStep(): void {
    this.pressed.clear();
  }

  /** Move input from WASD or the arrow keys: x is right, y is forward, each -1 to 1. */
  moveAxes(): { x: number; y: number } {
    const k = (a: string, b: string) => (this.isDown(a) || this.isDown(b) ? 1 : 0);
    return {
      x: k('KeyD', 'ArrowRight') - k('KeyA', 'ArrowLeft'),
      y: k('KeyW', 'ArrowUp') - k('KeyS', 'ArrowDown'),
    };
  }

  /** Mouse movement in pixels since the last call. */
  takeMouse(): { dx: number; dy: number } {
    const m = { dx: this.dx, dy: this.dy };
    this.dx = this.dy = 0;
    return m;
  }

  /** Mouse wheel notches since the last call (positive = toward the player). */
  takeWheel(): number {
    const w = this.wheel;
    this.wheel = 0;
    return w;
  }
}
