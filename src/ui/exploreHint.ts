import type { Input } from '../engine/input';

/** Phase 1 helper: tells the player how to fly around the test level. */
export class ExploreHint {
  private start: HTMLDivElement;
  private controls: HTMLDivElement;
  private input: Input;

  constructor(parent: HTMLElement, input: Input) {
    this.input = input;
    this.start = document.createElement('div');
    this.start.className = 'click-to-start';
    this.start.textContent = 'Click to look around!';
    this.controls = document.createElement('div');
    this.controls.className = 'controls-hint';
    this.controls.innerHTML =
      '<b>Mouse</b> look · <b>W A S D</b> fly · <b>Space</b> up · <b>Shift</b> down · <b>Esc</b> free the mouse';
    parent.append(this.start, this.controls);
  }

  update(): void {
    this.start.hidden = this.input.pointerLocked;
  }
}
