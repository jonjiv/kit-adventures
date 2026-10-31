import type { Input } from '../engine/input';

/** How long the controls reminder stays up once play starts. */
const SHOW_CONTROLS_FOR = 30;

/** "Click to play" prompt, and a reminder of the controls for the first 30 seconds. */
export class PlayHint {
  private start: HTMLDivElement;
  private controls: HTMLDivElement;
  private input: Input;
  private playTime = 0;

  constructor(parent: HTMLElement, input: Input) {
    this.input = input;
    this.start = document.createElement('div');
    this.start.className = 'click-to-start';
    this.start.textContent = 'Click to play!';
    this.controls = document.createElement('div');
    this.controls.className = 'controls-hint';
    this.controls.innerHTML =
      '<b>W A S D</b> run · <b>Mouse</b> look · <b>Space</b> jump (again in the air to double jump) · <b>Wheel</b> zoom';
    parent.append(this.start, this.controls);
  }

  update(dt: number): void {
    const playing = this.input.pointerLocked;
    this.start.hidden = playing;
    if (playing) this.playTime += dt;
    this.controls.classList.toggle('faded', this.playTime > SHOW_CONTROLS_FOR);
  }
}
