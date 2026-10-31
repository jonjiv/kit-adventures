// On-screen controls for iPads and phones: a joystick that appears under the
// left thumb, drag-to-look on the right, and Jump, Dash and Pause buttons.
// They switch on with the first touch and hide again when a keyboard or mouse is used.

import { TUNING } from '../player/tuning';

export type ButtonSize = 'small' | 'medium' | 'large';
export type CameraSpeed = 'slow' | 'normal' | 'fast';

export interface TouchSettings {
  size: ButtonSize;
  /** Swaps sides: joystick on the right, buttons on the left. */
  leftHanded: boolean;
  cameraSpeed: CameraSpeed;
}

export const DEFAULT_TOUCH_SETTINGS: TouchSettings = { size: 'medium', leftHanded: false, cameraSpeed: 'normal' };
const SETTINGS_KEY = 'kit-adventures.touch-settings';

export function loadTouchSettings(): TouchSettings {
  try {
    const raw = localStorage.getItem(SETTINGS_KEY);
    if (raw) return { ...DEFAULT_TOUCH_SETTINGS, ...(JSON.parse(raw) as Partial<TouchSettings>) };
  } catch {
    // Private browsing or blocked storage: just use the defaults.
  }
  return { ...DEFAULT_TOUCH_SETTINGS };
}

function saveTouchSettings(s: TouchSettings): void {
  try {
    localStorage.setItem(SETTINGS_KEY, JSON.stringify(s));
  } catch {
    // Not saved, but the game still works.
  }
}

/**
 * Stick value from how far the thumb moved from where it landed, in pixels:
 * x is right, y is forward. Small wiggles in the middle count as nothing, and
 * the stick is fully pushed a little before the edge of the ring.
 */
export function stickFromOffset(dx: number, dy: number, radius: number): { x: number; y: number } {
  const t = TUNING.touch;
  const dist = Math.hypot(dx, dy);
  const len = dist / radius;
  if (len <= t.stickDeadZone) return { x: 0, y: 0 };
  const strength = Math.min(1, (len - t.stickDeadZone) / (t.stickFullAt - t.stickDeadZone));
  return { x: (dx / dist) * strength, y: (-dy / dist) * strength };
}

interface Drag {
  id: number;
  /** Where the thumb landed (the joystick's center). */
  x0: number;
  y0: number;
  /** Where it was last seen. */
  x: number;
  y: number;
}

export class TouchControls {
  /** True after the screen is touched, until a keyboard or mouse is used again. */
  active = false;
  /** True while playing (false while the start panel is showing). */
  playing = false;
  settings: TouchSettings;
  /** Called when the pause button is pressed or the device turns sideways. */
  onPause: () => void = () => {};

  private root: HTMLDivElement;
  private stickBase: HTMLDivElement;
  private stickKnob: HTMLDivElement;
  private stickDrag: Drag | null = null;
  private lookDrag: Drag | null = null;
  private stickValue = { x: 0, y: 0 };
  private lookDx = 0;
  private lookDy = 0;
  private lookEndedAt = 0;
  private jumpDown = false;
  private jumpTapped = false;
  private dashTapped = false;

  constructor(parent: HTMLElement) {
    this.settings = loadTouchSettings();
    this.root = document.createElement('div');
    this.root.className = 'touch-ui';

    this.stickBase = document.createElement('div');
    this.stickBase.className = 'touch-stick';
    this.stickKnob = document.createElement('div');
    this.stickKnob.className = 'touch-knob';
    this.stickBase.appendChild(this.stickKnob);

    const jump = this.button('touch-jump', 'JUMP', () => {
      this.jumpDown = this.jumpTapped = true;
    }, () => {
      this.jumpDown = false;
    });
    const dash = this.button('touch-dash', 'DASH', () => {
      this.dashTapped = true;
    });
    const pause = this.button('touch-pause', '', () => this.pause());
    pause.setAttribute('aria-label', 'Pause');
    pause.innerHTML = '<svg viewBox="0 0 24 24" width="30" height="30"><rect x="5" y="4" width="5" height="16" rx="2" fill="currentColor"/><rect x="14" y="4" width="5" height="16" rx="2" fill="currentColor"/></svg>';

    this.root.append(this.stickBase, dash, jump, pause);
    parent.appendChild(this.root);
    this.applySettings();

    window.addEventListener('pointerdown', (e) => this.down(e));
    window.addEventListener('pointermove', (e) => this.move(e));
    window.addEventListener('pointerup', (e) => this.up(e));
    window.addEventListener('pointercancel', (e) => this.up(e));
    window.addEventListener('keydown', () => this.setActive(false));
    // Older iPads send touch events before pointer events; either one switches touch on.
    window.addEventListener('touchstart', () => this.setActive(true), { passive: true });
    window.matchMedia('(orientation: portrait)').addEventListener('change', (e) => {
      if (e.matches && this.active) this.pause();
    });
  }

  /** Starts playing from the start panel. */
  play(): void {
    this.playing = true;
    this.root.classList.add('playing');
    // Fill the whole screen where the browser allows it (Android, some iPads).
    const el = document.documentElement;
    if (document.fullscreenEnabled && !document.fullscreenElement) {
      el.requestFullscreen?.().then(() => {
        const orientation = screen.orientation as ScreenOrientation & { lock?: (o: string) => Promise<void> };
        return orientation.lock?.('landscape');
      }).catch(() => {});
    }
  }

  pause(): void {
    if (!this.playing) return;
    this.playing = false;
    this.root.classList.remove('playing');
    this.releaseAll();
    this.onPause();
  }

  setSettings(s: TouchSettings): void {
    this.settings = s;
    saveTouchSettings(s);
    this.applySettings();
  }

  /** The joystick: x right, y forward, each -1 to 1. */
  get stick(): { x: number; y: number } {
    return this.stickValue;
  }

  get jumpHeld(): boolean {
    return this.jumpDown;
  }

  /** True if Jump was tapped since the last physics step. */
  get jumpPressed(): boolean {
    return this.jumpTapped;
  }

  get dashPressed(): boolean {
    return this.dashTapped;
  }

  /** Seconds since the player last dragged to look (0 while dragging), for the camera's auto-follow. */
  get secondsSinceLook(): number {
    return this.lookDrag ? 0 : (performance.now() - this.lookEndedAt) / 1000;
  }

  /** Look-drag movement in pixels since the last call. */
  takeLook(): { dx: number; dy: number } {
    const d = { dx: this.lookDx, dy: this.lookDy };
    this.lookDx = this.lookDy = 0;
    return d;
  }

  /** Call after every physics step. */
  endStep(): void {
    this.jumpTapped = this.dashTapped = false;
  }

  private setActive(on: boolean): void {
    if (on === this.active) return;
    this.active = on;
    document.body.classList.toggle('touch-mode', on);
    if (!on) {
      this.releaseAll();
      this.playing = false;
      this.root.classList.remove('playing');
    }
  }

  private applySettings(): void {
    const t = TUNING.touch;
    const scale = t.sizeScale[this.settings.size];
    const css = this.root.style;
    css.setProperty('--jump-size', `${Math.round(t.jumpButtonSize * scale)}px`);
    css.setProperty('--dash-size', `${Math.round(t.dashButtonSize * scale)}px`);
    css.setProperty('--stick-size', `${Math.round(t.stickRadius * scale * 2)}px`);
    this.root.classList.toggle('left-handed', this.settings.leftHanded);
  }

  private get stickRadius(): number {
    return TUNING.touch.stickRadius * TUNING.touch.sizeScale[this.settings.size];
  }

  private button(cls: string, label: string, onDown: () => void, onUp: () => void = () => {}): HTMLButtonElement {
    const b = document.createElement('button');
    b.className = `touch-button ${cls}`;
    b.textContent = label;
    b.addEventListener('pointerdown', (e) => {
      // Buttons are only for touch; keep the press from also starting a joystick or look drag.
      e.preventDefault();
      e.stopPropagation();
      b.classList.add('pressed');
      onDown();
      try {
        // Keeps the press until the thumb lifts, even if it slides off the button.
        b.setPointerCapture(e.pointerId);
      } catch {
        // The touch already ended; the press still counts.
      }
    });
    const release = () => {
      b.classList.remove('pressed');
      onUp();
    };
    b.addEventListener('pointerup', release);
    b.addEventListener('pointercancel', release);
    b.addEventListener('lostpointercapture', release);
    b.addEventListener('contextmenu', (e) => e.preventDefault());
    return b;
  }

  private down(e: PointerEvent): void {
    if (e.pointerType === 'mouse') {
      this.setActive(false);
      return;
    }
    if (e.pointerType !== 'touch') return;
    this.setActive(true);
    if (!this.playing) return;
    const leftHalf = e.clientX < window.innerWidth / 2;
    const stickSide = this.settings.leftHanded ? !leftHalf : leftHalf;
    const drag: Drag = { id: e.pointerId, x0: e.clientX, y0: e.clientY, x: e.clientX, y: e.clientY };
    if (stickSide && !this.stickDrag) {
      // Keep the whole ring on screen even if the thumb lands near the edge.
      const r = this.stickRadius;
      drag.x0 = Math.min(Math.max(drag.x0, r + 8), window.innerWidth - r - 8);
      drag.y0 = Math.min(Math.max(drag.y0, r + 8), window.innerHeight - r - 8);
      this.stickDrag = drag;
      this.stickBase.style.left = `${drag.x0}px`;
      this.stickBase.style.top = `${drag.y0}px`;
      this.stickBase.classList.add('shown');
      this.updateStick();
    } else if (!stickSide && !this.lookDrag) {
      this.lookDrag = drag;
    }
  }

  private move(e: PointerEvent): void {
    if (e.pointerType === 'mouse' && (e.movementX !== 0 || e.movementY !== 0)) {
      this.setActive(false);
      return;
    }
    if (this.stickDrag?.id === e.pointerId) {
      this.stickDrag.x = e.clientX;
      this.stickDrag.y = e.clientY;
      this.updateStick();
    } else if (this.lookDrag?.id === e.pointerId) {
      this.lookDx += e.clientX - this.lookDrag.x;
      this.lookDy += e.clientY - this.lookDrag.y;
      this.lookDrag.x = e.clientX;
      this.lookDrag.y = e.clientY;
    }
  }

  private up(e: PointerEvent): void {
    if (this.stickDrag?.id === e.pointerId) this.releaseStick();
    if (this.lookDrag?.id === e.pointerId) {
      this.lookDrag = null;
      this.lookEndedAt = performance.now();
    }
  }

  private updateStick(): void {
    const d = this.stickDrag!;
    const r = this.stickRadius;
    const dx = d.x - d.x0, dy = d.y - d.y0;
    this.stickValue = stickFromOffset(dx, dy, r);
    // The knob stays inside the ring.
    const k = Math.min(1, r / Math.max(1, Math.hypot(dx, dy)));
    this.stickKnob.style.transform = `translate(${dx * k}px, ${dy * k}px)`;
  }

  private releaseStick(): void {
    this.stickDrag = null;
    this.stickValue = { x: 0, y: 0 };
    this.stickBase.classList.remove('shown');
    this.stickKnob.style.transform = '';
  }

  private releaseAll(): void {
    this.releaseStick();
    if (this.lookDrag) this.lookEndedAt = performance.now();
    this.lookDrag = null;
    this.jumpDown = false;
    this.lookDx = this.lookDy = 0;
  }
}
