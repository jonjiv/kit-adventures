import type { Input } from '../engine/input';
import type { TouchSettings } from '../engine/touchControls';

/** How long the controls reminder stays up once play starts. */
const SHOW_CONTROLS_FOR = 30;

const KEYBOARD_CONTROLS = '<b>WASD</b> run · <b>Mouse</b> look · <b>Space</b> jump · <b>Shift</b> dash · <b>Wheel</b> zoom · <b>M</b> sound';
const TOUCH_CONTROLS = '<b>Left thumb</b> run · <b>Right thumb</b> look · <b>JUMP</b> · <b>DASH</b>';
const TOUCH_CONTROLS_LEFT = '<b>Right thumb</b> run · <b>Left thumb</b> look · <b>JUMP</b> · <b>DASH</b>';

export interface LevelChoice {
  id: string;
  name: string;
}

/** One row of the touch settings: a label and a few big buttons, one of them picked. */
interface SettingRow<K extends keyof TouchSettings> {
  key: K;
  label: string;
  options: [TouchSettings[K], string][];
}

const SETTING_ROWS = [
  { key: 'size', label: 'Buttons', options: [['small', 'Small'], ['medium', 'Medium'], ['large', 'Large']] },
  { key: 'cameraSpeed', label: 'Camera', options: [['slow', 'Slow'], ['normal', 'Normal'], ['fast', 'Fast']] },
  { key: 'leftHanded', label: 'Hands', options: [[false, 'Right hand'], [true, 'Left hand']] },
] as const satisfies readonly SettingRow<keyof TouchSettings>[];

/**
 * The "Click to play" / "Tap to play" panel with buttons to pick a level
 * (shown whenever the game is paused), and a reminder of the controls for the
 * first 30 seconds. On touch it also has a Settings page for the touch controls.
 */
export class PlayHint {
  private panel: HTMLDivElement;
  private title: HTMLDivElement;
  private main: HTMLDivElement;
  private settings: HTMLDivElement;
  private settingsButton: HTMLButtonElement;
  private buttons = new Map<string, HTMLButtonElement>();
  private settingButtons: { key: keyof TouchSettings; value: unknown; button: HTMLButtonElement }[] = [];
  private controls: HTMLDivElement;
  private input: Input;
  private playTime = 0;
  private wasTouch: boolean | null = null;

  constructor(parent: HTMLElement, input: Input, levels: LevelChoice[], onPick: (id: string) => void) {
    this.input = input;
    this.panel = document.createElement('div');
    this.panel.className = 'start-panel';
    this.title = document.createElement('div');
    this.title.className = 'start-title';

    this.main = document.createElement('div');
    this.main.className = 'start-main';
    const row = document.createElement('div');
    row.className = 'level-row';
    for (const level of levels) {
      const b = document.createElement('button');
      b.className = 'level-button';
      b.textContent = level.name;
      b.addEventListener('click', (e) => {
        e.stopPropagation();
        onPick(level.id);
        input.startPlaying();
      });
      row.appendChild(b);
      this.buttons.set(level.id, b);
    }
    this.settingsButton = document.createElement('button');
    this.settingsButton.className = 'small-button touch-only';
    this.settingsButton.textContent = '⚙ Settings';
    this.settingsButton.addEventListener('click', (e) => {
      e.stopPropagation();
      this.showSettings(true);
    });
    this.main.append(row, this.settingsButton);

    this.settings = this.buildSettings();
    this.settings.hidden = true;
    this.panel.append(this.title, this.main, this.settings);
    this.panel.addEventListener('click', () => {
      if (this.settings.hidden) input.startPlaying();
    });

    this.controls = document.createElement('div');
    this.controls.className = 'controls-hint';
    parent.append(this.panel, this.controls);
  }

  setCurrent(id: string): void {
    for (const [levelId, b] of this.buttons) b.classList.toggle('current', levelId === id);
    this.playTime = 0;
  }

  update(dt: number): void {
    const playing = this.input.playing;
    this.panel.hidden = playing;
    if (playing) this.playTime += dt;
    this.controls.classList.toggle('faded', this.playTime > SHOW_CONTROLS_FOR);

    const touch = this.input.touch.active;
    // On phones the panel fills the screen, so the reminder waits until play starts.
    this.controls.hidden = touch && !playing;
    if (touch !== this.wasTouch) {
      this.wasTouch = touch;
      if (!touch) this.showSettings(false);
      this.refreshText();
      this.playTime = 0;
    }
  }

  private refreshText(): void {
    const touch = this.input.touch;
    this.title.textContent = this.settings.hidden ? (touch.active ? 'Tap to play!' : 'Click to play!') : 'Settings';
    this.controls.innerHTML = !touch.active ? KEYBOARD_CONTROLS : touch.settings.leftHanded ? TOUCH_CONTROLS_LEFT : TOUCH_CONTROLS;
  }

  private showSettings(on: boolean): void {
    this.settings.hidden = !on;
    this.main.hidden = on;
    this.refreshText();
  }

  private buildSettings(): HTMLDivElement {
    const box = document.createElement('div');
    box.className = 'settings';
    box.addEventListener('click', (e) => e.stopPropagation());
    for (const row of SETTING_ROWS) {
      const line = document.createElement('div');
      line.className = 'setting-row';
      const label = document.createElement('span');
      label.className = 'setting-label';
      label.textContent = row.label;
      line.appendChild(label);
      for (const [value, text] of row.options) {
        const b = document.createElement('button');
        b.className = 'setting-button';
        b.textContent = text;
        b.addEventListener('click', () => {
          const touch = this.input.touch;
          touch.setSettings({ ...touch.settings, [row.key]: value });
          this.refreshSettings();
          this.refreshText();
        });
        line.appendChild(b);
        this.settingButtons.push({ key: row.key, value, button: b });
      }
      box.appendChild(line);
    }
    const back = document.createElement('button');
    back.className = 'small-button';
    back.textContent = 'Done';
    back.addEventListener('click', () => this.showSettings(false));
    box.appendChild(back);
    this.refreshSettings();
    return box;
  }

  private refreshSettings(): void {
    const s = this.input.touch.settings;
    for (const { key, value, button } of this.settingButtons) button.classList.toggle('current', s[key] === value);
  }
}
