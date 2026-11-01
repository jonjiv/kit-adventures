/**
 * A full-screen layer with a card in the middle, used for the finish and
 * leaderboard screens. It keeps presses from reaching the game underneath.
 */
export class Overlay {
  readonly root: HTMLDivElement;
  readonly card: HTMLDivElement;

  constructor(parent: HTMLElement, className: string) {
    this.root = document.createElement('div');
    this.root.className = 'overlay';
    this.root.hidden = true;
    this.card = document.createElement('div');
    this.card.className = `overlay-card ${className}`;
    this.root.appendChild(this.card);
    for (const type of ['pointerdown', 'click', 'touchstart'] as const) {
      this.root.addEventListener(type, (e) => e.stopPropagation());
    }
    parent.appendChild(this.root);
  }

  get open(): boolean {
    return !this.root.hidden;
  }

  set open(on: boolean) {
    this.root.hidden = !on;
  }
}

export function button(className: string, text: string, onClick: () => void): HTMLButtonElement {
  const b = document.createElement('button');
  b.type = 'button';
  b.className = className;
  b.textContent = text;
  b.addEventListener('click', onClick);
  return b;
}
