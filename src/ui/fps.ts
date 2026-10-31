/** Small frames-per-second counter. F3 shows or hides it. */
export class FpsMeter {
  private el: HTMLDivElement;
  private frames = 0;
  private time = 0;

  constructor(parent: HTMLElement) {
    this.el = document.createElement('div');
    this.el.className = 'fps';
    parent.appendChild(this.el);
    window.addEventListener('keydown', (e) => {
      if (e.code === 'F3') {
        e.preventDefault();
        this.el.hidden = !this.el.hidden;
      }
    });
  }

  frame(dt: number): void {
    this.frames++;
    this.time += dt;
    if (this.time >= 0.5) {
      this.el.textContent = `${Math.round(this.frames / this.time)} fps`;
      this.frames = 0;
      this.time = 0;
    }
  }
}
