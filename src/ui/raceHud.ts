import { formatTime, type Race } from '../race/race';

/** The race timer at the top of the screen, and the big 3, 2, 1, GO! in the middle. */
export class RaceHud {
  private timer: HTMLDivElement;
  private banner: HTMLDivElement;
  private shownBanner = '';
  private shownTime = '';

  constructor(parent: HTMLElement) {
    this.timer = document.createElement('div');
    this.timer.className = 'race-timer';
    this.banner = document.createElement('div');
    this.banner.className = 'race-banner';
    parent.append(this.timer, this.banner);
  }

  update(race: Race, visible: boolean): void {
    this.timer.hidden = !visible;
    const time = formatTime(race.timeMs);
    if (time !== this.shownTime) this.timer.textContent = this.shownTime = time;

    const text = visible ? race.banner : '';
    if (text !== this.shownBanner) {
      this.shownBanner = text;
      this.banner.textContent = text;
      this.banner.classList.toggle('go', text === 'GO!');
      // Start the pop animation again for each new number.
      this.banner.classList.remove('pop');
      void this.banner.offsetWidth;
      if (text) this.banner.classList.add('pop');
    }
  }
}
