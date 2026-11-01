import type { Leaderboard, Score } from '../leaderboard/leaderboard';
import { formatTime } from '../race/race';
import { button, Overlay } from './overlay';
import type { LevelChoice } from './playHint';

/** The quickest times for each level, quickest first, with a tab for each level. */
export class LeaderboardPanel {
  private overlay: Overlay;
  private board: Leaderboard;
  private tabs = new Map<string, HTMLButtonElement>();
  private list: HTMLOListElement;
  private status: HTMLDivElement;
  private again: HTMLButtonElement;
  /** The score just saved, picked out in the list. */
  private highlight: { level: string; score: Score } | null = null;
  private loadCount = 0;
  private closed: (playAgain: boolean) => void;

  /** `closed(true)` means play the same level again; `closed(false)` goes back to picking a level. */
  constructor(parent: HTMLElement, board: Leaderboard, levels: LevelChoice[], closed: (playAgain: boolean) => void) {
    this.board = board;
    this.overlay = new Overlay(parent, 'board-card');
    const title = document.createElement('div');
    title.className = 'board-title';
    title.textContent = '🏆 Leaderboard';

    const tabRow = document.createElement('div');
    tabRow.className = 'board-tabs';
    tabRow.setAttribute('role', 'tablist');
    for (const level of levels) {
      const tab = button('board-tab', level.name, () => void this.showLevel(level.id));
      tab.setAttribute('role', 'tab');
      tabRow.appendChild(tab);
      this.tabs.set(level.id, tab);
    }

    this.status = document.createElement('div');
    this.status.className = 'board-status';
    this.list = document.createElement('ol');
    this.list.className = 'board-list';

    const note = document.createElement('div');
    note.className = 'board-note';
    note.textContent = board.global ? 'Times from everyone who plays Kit Adventures.' : 'Times saved on this device.';

    this.again = button('level-button', 'Play again', () => this.close(true));
    const pick = button('small-button', 'Pick a level', () => this.close(false));
    const row = document.createElement('div');
    row.className = 'button-row';
    row.append(this.again, pick);

    this.overlay.card.append(title, tabRow, this.status, this.list, note, row);
    this.closed = closed;
  }

  get open(): boolean {
    return this.overlay.open;
  }

  /** Opens on a level's tab. After a race, pass the new score to pick it out, and offer Play again. */
  show(levelId: string, saved: Score | null, afterRace: boolean): void {
    this.highlight = saved ? { level: levelId, score: saved } : null;
    this.again.hidden = !afterRace;
    this.overlay.open = true;
    void this.showLevel(levelId);
  }

  private async showLevel(levelId: string): Promise<void> {
    for (const [id, tab] of this.tabs) {
      tab.classList.toggle('current', id === levelId);
      tab.setAttribute('aria-selected', String(id === levelId));
    }
    const load = ++this.loadCount;
    this.list.replaceChildren();
    this.status.textContent = 'Loading…';
    let scores: Score[];
    try {
      scores = await this.board.top(levelId);
    } catch {
      if (load === this.loadCount) this.status.textContent = "Couldn't load the leaderboard. Check the internet and try again.";
      return;
    }
    // Another tab was picked while this one was loading.
    if (load !== this.loadCount) return;
    this.status.textContent = scores.length ? '' : 'No times yet. Be the first!';

    const mine = this.highlight?.level === levelId ? this.highlight.score : null;
    let marked = false;
    scores.forEach((s, i) => {
      const row = document.createElement('li');
      row.className = 'board-row';
      if (mine && !marked && s.name === mine.name && s.ms === mine.ms) {
        row.classList.add('mine');
        marked = true;
      }
      const place = document.createElement('span');
      place.className = 'board-place';
      place.textContent = i < 3 ? ['🥇', '🥈', '🥉'][i] : String(i + 1);
      const name = document.createElement('span');
      name.className = 'board-name';
      // textContent, never innerHTML: names come from other players.
      name.textContent = s.name;
      const time = document.createElement('span');
      time.className = 'board-time';
      time.textContent = formatTime(s.ms);
      row.append(place, name, time);
      this.list.appendChild(row);
    });
    this.list.querySelector('.mine')?.scrollIntoView({ block: 'nearest' });
  }

  private close(playAgain: boolean): void {
    this.overlay.open = false;
    this.closed(playAgain);
  }

}
