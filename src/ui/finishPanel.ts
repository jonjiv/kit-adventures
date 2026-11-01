import type { Leaderboard, Score } from '../leaderboard/leaderboard';
import { cleanName, isRude, MAX_NAME } from '../leaderboard/names';
import { formatTime } from '../race/race';
import { button, Overlay } from './overlay';
import type { LevelChoice } from './playHint';

const NAME_KEY = 'kit-adventures.name';

/** "You Did It!" with the time, and a name box to put the time on the leaderboard. */
export class FinishPanel {
  private overlay: Overlay;
  private board: Leaderboard;
  private levelName: HTMLDivElement;
  private time: HTMLDivElement;
  private input: HTMLInputElement;
  private save: HTMLButtonElement;
  private message: HTMLDivElement;
  private level: LevelChoice | null = null;
  private ms = 0;
  private saving = false;
  private done: (level: LevelChoice, score: Score | null) => void;

  /** `done` gets the saved score, or null if the player skipped saving. */
  constructor(parent: HTMLElement, board: Leaderboard, done: (level: LevelChoice, score: Score | null) => void) {
    this.board = board;
    this.done = done;
    this.overlay = new Overlay(parent, 'finish-card');
    const title = document.createElement('div');
    title.className = 'finish-title';
    title.textContent = 'You Did It!';
    this.levelName = document.createElement('div');
    this.levelName.className = 'finish-level';
    this.time = document.createElement('div');
    this.time.className = 'finish-time';

    const form = document.createElement('form');
    form.className = 'finish-form';
    const label = document.createElement('label');
    label.className = 'finish-label';
    label.textContent = 'Your name for the leaderboard';
    this.input = document.createElement('input');
    this.input.className = 'name-input';
    this.input.maxLength = MAX_NAME;
    this.input.autocomplete = 'off';
    this.input.spellcheck = false;
    this.input.enterKeyHint = 'done';
    label.appendChild(this.input);
    this.message = document.createElement('div');
    this.message.className = 'finish-message';
    this.save = document.createElement('button');
    this.save.type = 'submit';
    this.save.className = 'level-button';
    this.save.textContent = 'Save my time';
    const skip = button('small-button', 'Skip', () => this.close(null));
    const row = document.createElement('div');
    row.className = 'button-row';
    row.append(this.save, skip);
    form.append(label, this.message, row);
    if (!board.global) {
      const note = document.createElement('div');
      note.className = 'board-note';
      note.textContent = 'Times are saved on this device.';
      form.appendChild(note);
    }
    form.addEventListener('submit', (e) => {
      e.preventDefault();
      void this.submit();
    });
    this.input.addEventListener('input', () => (this.message.textContent = ''));

    this.overlay.card.append(title, this.levelName, this.time, form);
  }

  get open(): boolean {
    return this.overlay.open;
  }

  show(level: LevelChoice, ms: number): void {
    this.level = level;
    this.ms = ms;
    this.levelName.textContent = level.name;
    this.time.textContent = formatTime(ms);
    this.message.textContent = '';
    try {
      this.input.value = localStorage.getItem(NAME_KEY) ?? '';
    } catch {
      this.input.value = '';
    }
    this.setSaving(false);
    this.overlay.open = true;
    // Typing straight away works with a keyboard; on a tablet, tapping the box opens its keyboard.
    this.input.focus({ preventScroll: true });
  }

  private async submit(): Promise<void> {
    if (this.saving || !this.level) return;
    const name = cleanName(this.input.value);
    this.input.value = name;
    if (!name) {
      this.message.textContent = 'Type your name first!';
      return;
    }
    if (isRude(name)) {
      this.message.textContent = 'Please pick a different name.';
      return;
    }
    this.setSaving(true);
    const score = { name, ms: this.ms };
    try {
      await this.board.add(this.level.id, score);
    } catch {
      this.setSaving(false);
      this.message.textContent = "Couldn't reach the leaderboard. Check the internet and try again.";
      return;
    }
    try {
      localStorage.setItem(NAME_KEY, name);
    } catch {
      // Just not remembered for next time.
    }
    this.close(score);
  }

  private setSaving(on: boolean): void {
    this.saving = on;
    this.save.disabled = on;
    this.save.textContent = on ? 'Saving…' : 'Save my time';
  }

  private close(score: Score | null): void {
    this.input.blur();
    this.overlay.open = false;
    if (this.level) this.done(this.level, score);
  }
}
