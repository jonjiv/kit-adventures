import type { Sounds } from '../audio/sounds';

const SPEAKER = '<path d="M4 9h4l5-4v14l-5-4H4z" fill="currentColor"/>';
const ON = `<svg viewBox="0 0 24 24" width="28" height="28">${SPEAKER}<path d="M16 8.5a5 5 0 0 1 0 7M18.5 6a8.5 8.5 0 0 1 0 12" stroke="currentColor" stroke-width="2" fill="none" stroke-linecap="round"/></svg>`;
const OFF = `<svg viewBox="0 0 24 24" width="28" height="28">${SPEAKER}<path d="M16 9l5 6M21 9l-5 6" stroke="currentColor" stroke-width="2.4" stroke-linecap="round"/></svg>`;

/** A speaker button in the corner that turns the sound on and off. M does the same. */
export class MuteButton {
  private el: HTMLButtonElement;
  private sounds: Sounds;

  constructor(parent: HTMLElement, sounds: Sounds) {
    this.sounds = sounds;
    this.el = document.createElement('button');
    this.el.className = 'mute-button';
    // Keep the press from starting a joystick or look drag, or reaching the start panel.
    this.el.addEventListener('pointerdown', (e) => e.stopPropagation());
    this.el.addEventListener('click', (e) => {
      e.stopPropagation();
      this.toggle();
    });
    window.addEventListener('keydown', (e) => {
      if (e.code === 'KeyM' && !e.repeat) this.toggle();
    });
    parent.appendChild(this.el);
    this.refresh();
  }

  private toggle(): void {
    this.sounds.setMuted(!this.sounds.muted);
    this.refresh();
    this.sounds.play('click');
  }

  private refresh(): void {
    const muted = this.sounds.muted;
    this.el.innerHTML = muted ? OFF : ON;
    this.el.classList.toggle('muted', muted);
    const label = muted ? 'Sound is off (M)' : 'Sound is on (M)';
    this.el.setAttribute('aria-label', label);
    this.el.title = label;
  }
}
