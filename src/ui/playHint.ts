import type { Input } from '../engine/input';

/** How long the controls reminder stays up once play starts. */
const SHOW_CONTROLS_FOR = 30;

export interface LevelChoice {
  id: string;
  name: string;
}

/**
 * The "Click to play" panel with buttons to pick a level (shown whenever the
 * mouse is free), and a reminder of the controls for the first 30 seconds.
 */
export class PlayHint {
  private panel: HTMLDivElement;
  private buttons = new Map<string, HTMLButtonElement>();
  private controls: HTMLDivElement;
  private input: Input;
  private playTime = 0;

  constructor(parent: HTMLElement, input: Input, levels: LevelChoice[], onPick: (id: string) => void) {
    this.input = input;
    this.panel = document.createElement('div');
    this.panel.className = 'start-panel';
    const title = document.createElement('div');
    title.className = 'start-title';
    title.textContent = 'Click to play!';
    const row = document.createElement('div');
    row.className = 'level-row';
    for (const level of levels) {
      const b = document.createElement('button');
      b.className = 'level-button';
      b.textContent = level.name;
      b.addEventListener('click', (e) => {
        e.stopPropagation();
        onPick(level.id);
        input.lockPointer();
      });
      row.appendChild(b);
      this.buttons.set(level.id, b);
    }
    this.panel.append(title, row);
    this.panel.addEventListener('click', () => input.lockPointer());

    this.controls = document.createElement('div');
    this.controls.className = 'controls-hint';
    this.controls.innerHTML = '<b>WASD</b> run · <b>Mouse</b> look · <b>Space</b> jump · <b>Shift</b> dash · <b>Wheel</b> zoom';
    parent.append(this.panel, this.controls);
  }

  setCurrent(id: string): void {
    for (const [levelId, b] of this.buttons) b.classList.toggle('current', levelId === id);
    this.playTime = 0;
  }

  update(dt: number): void {
    const playing = this.input.pointerLocked;
    this.panel.hidden = playing;
    if (playing) this.playTime += dt;
    this.controls.classList.toggle('faded', this.playTime > SHOW_CONTROLS_FOR);
  }
}
