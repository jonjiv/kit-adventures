// Keyboard, mouse and touch input. Keys use KeyboardEvent.code so they work on any keyboard layout.

import { TUNING } from '../player/tuning';
import { TouchControls } from './touchControls';

const BLOCK_DEFAULT = new Set(['Space', 'ArrowUp', 'ArrowDown', 'ArrowLeft', 'ArrowRight', 'Tab']);

export class Input {
  readonly touch: TouchControls;
  private canvas: HTMLElement;
  private down = new Set<string>();
  private pressed = new Set<string>();
  private dx = 0;
  private dy = 0;
  private wheel = 0;

  constructor(canvas: HTMLElement, uiParent: HTMLElement) {
    this.canvas = canvas;
    this.touch = new TouchControls(uiParent);
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
    canvas.addEventListener('click', () => {
      if (!this.touch.active) this.lockPointer();
    });
  }

  get pointerLocked(): boolean {
    return document.pointerLockElement === this.canvas;
  }

  /** True while the game is being played (not on the start panel). */
  get playing(): boolean {
    return this.touch.active ? this.touch.playing : this.pointerLocked;
  }

  /** Starts playing: locks the mouse, or shows the touch controls. */
  startPlaying(): void {
    if (this.touch.active) this.touch.play();
    else this.lockPointer();
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

  /** Space or the Jump button, pressed since the last physics step. */
  jumpPressed(): boolean {
    return this.wasPressed('Space') || this.touch.jumpPressed;
  }

  jumpHeld(): boolean {
    return this.isDown('Space') || this.touch.jumpHeld;
  }

  dashPressed(): boolean {
    return this.wasPressed('ShiftLeft') || this.wasPressed('ShiftRight') || this.touch.dashPressed;
  }

  /** Call after every physics step. */
  endStep(): void {
    this.pressed.clear();
    this.touch.endStep();
  }

  /** Move input from WASD, the arrow keys or the joystick: x is right, y is forward, each -1 to 1. */
  moveAxes(): { x: number; y: number } {
    const k = (a: string, b: string) => (this.isDown(a) || this.isDown(b) ? 1 : 0);
    const x = k('KeyD', 'ArrowRight') - k('KeyA', 'ArrowLeft');
    const y = k('KeyW', 'ArrowUp') - k('KeyS', 'ArrowDown');
    return x === 0 && y === 0 ? this.touch.stick : { x, y };
  }

  /** Mouse movement in pixels since the last call. */
  takeMouse(): { dx: number; dy: number } {
    const m = { dx: this.dx, dy: this.dy };
    this.dx = this.dy = 0;
    return m;
  }

  /** Camera turn from the mouse and look drags since the last call, in radians. */
  takeLook(): { yaw: number; pitch: number } {
    const m = this.takeMouse();
    const d = this.touch.takeLook();
    const t = TUNING.touch.lookSensitivity * TUNING.touch.cameraSpeedScale[this.touch.settings.cameraSpeed];
    const s = TUNING.mouse.sensitivity;
    return { yaw: m.dx * s + d.dx * t, pitch: m.dy * s + d.dy * t };
  }

  /** Mouse wheel notches since the last call (positive = toward the player). */
  takeWheel(): number {
    const w = this.wheel;
    this.wheel = 0;
    return w;
  }
}
