// Sound effects, all made in code with the Web Audio API (no sound files).
// Browsers only allow sound after the player clicks or taps, so the audio
// starts on the first press. Muting is remembered on this device.

import { TUNING } from '../player/tuning';

export type SoundName =
  | 'jump' | 'doubleJump' | 'wallJump' | 'wallRun' | 'wallStep' | 'ledgeGrab' | 'climb'
  | 'dash' | 'land' | 'respawn' | 'checkpoint' | 'bounce' | 'updraft' | 'lowGravity' | 'click'
  | 'beep' | 'go' | 'finish';

const MUTED_KEY = 'kit-adventures.muted';

function loadMuted(): boolean {
  try {
    return localStorage.getItem(MUTED_KEY) === '1';
  } catch {
    return false;
  }
}

export class Sounds {
  muted = loadMuted();
  private ctx: AudioContext | null = null;
  private master: GainNode | null = null;
  private noiseBuffer: AudioBuffer | null = null;

  constructor() {
    // The first press anywhere wakes the audio up (capture, so buttons that stop the press still count).
    const unlock = () => this.unlock();
    window.addEventListener('pointerdown', unlock, { capture: true });
    window.addEventListener('keydown', unlock, { capture: true });
  }

  setMuted(muted: boolean): void {
    this.muted = muted;
    try {
      localStorage.setItem(MUTED_KEY, muted ? '1' : '0');
    } catch {
      // Not remembered, but still muted for now.
    }
    if (this.master && this.ctx) this.master.gain.setTargetAtTime(muted ? 0 : TUNING.sound.volume, this.ctx.currentTime, 0.02);
  }

  private unlock(): void {
    if (!this.ctx) {
      const Ctx = window.AudioContext ?? (window as unknown as { webkitAudioContext?: typeof AudioContext }).webkitAudioContext;
      if (!Ctx) return;
      this.ctx = new Ctx();
      this.master = this.ctx.createGain();
      this.master.gain.value = this.muted ? 0 : TUNING.sound.volume;
      this.master.connect(this.ctx.destination);
      // One second of white noise, reused for every whoosh and swish.
      const len = this.ctx.sampleRate;
      this.noiseBuffer = this.ctx.createBuffer(1, len, this.ctx.sampleRate);
      const data = this.noiseBuffer.getChannelData(0);
      for (let i = 0; i < len; i++) data[i] = Math.random() * 2 - 1;
    }
    if (this.ctx.state === 'suspended') void this.ctx.resume();
  }

  /** Plays a sound. `strength` (0 to 1) makes some sounds softer, like small landings. */
  play(name: SoundName, strength = 1): void {
    if (this.muted || !this.ctx || this.ctx.state !== 'running') return;
    switch (name) {
      case 'jump':
        this.tone('triangle', 330, 660, 0.12, 0.3);
        break;
      case 'doubleJump':
        this.tone('triangle', 520, 1040, 0.1, 0.25);
        this.tone('sine', 1400, 2100, 0.12, 0.12, 0.05);
        break;
      case 'wallJump':
        this.tone('square', 420, 840, 0.09, 0.12);
        this.whoosh(1200, 3000, 0.12, 0.15);
        break;
      case 'wallRun':
        this.whoosh(700, 2400, 0.25, 0.18);
        break;
      case 'wallStep':
        this.tone('sine', 900, 600, 0.03, 0.06);
        break;
      case 'ledgeGrab':
        this.tone('triangle', 220, 120, 0.08, 0.3);
        break;
      case 'climb':
        this.tone('triangle', 300, 420, 0.06, 0.15);
        this.tone('triangle', 420, 560, 0.06, 0.15, 0.07);
        break;
      case 'dash':
        this.whoosh(400, 3200, 0.22, 0.3);
        this.tone('sine', 300, 900, 0.15, 0.1);
        break;
      case 'land':
        this.tone('sine', 150, 55, 0.12, 0.35 * strength);
        this.whoosh(500, 200, 0.08, 0.12 * strength);
        break;
      case 'respawn':
        this.tone('square', 620, 150, 0.45, 0.12);
        break;
      case 'checkpoint':
        [523, 659, 784, 1047].forEach((f, i) => this.tone('triangle', f, f, 0.16, 0.22, i * 0.08));
        break;
      case 'bounce':
        // Boing!
        this.tone('sine', 140, 620, 0.3, 0.4, 0, 18);
        break;
      case 'updraft':
        this.whoosh(250, 1400, 0.7, 0.25);
        break;
      case 'lowGravity':
        this.tone('sine', 380, 760, 0.6, 0.18, 0, 7);
        this.tone('sine', 760, 380, 0.6, 0.1, 0.3, 5);
        break;
      case 'beep':
        this.tone('square', 440, 440, 0.18, 0.18);
        break;
      case 'go':
        this.tone('square', 880, 880, 0.45, 0.2);
        this.tone('triangle', 1320, 1320, 0.45, 0.15);
        break;
      case 'finish':
        // A happy little fanfare.
        [523, 659, 784, 1047, 784, 1047].forEach((f, i) => this.tone('triangle', f, f, i === 5 ? 0.6 : 0.14, 0.25, i * 0.11));
        this.tone('sine', 1568, 2093, 0.5, 0.1, 0.55, 6);
        break;
      case 'click':
        this.tone('triangle', 700, 900, 0.05, 0.15);
        break;
    }
  }

  /** A note sliding from one pitch to another, fading out. `wobble` adds vibrato (times per second). */
  private tone(type: OscillatorType, from: number, to: number, dur: number, vol: number, delay = 0, wobble = 0): void {
    const ctx = this.ctx!, t = ctx.currentTime + delay;
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();
    osc.type = type;
    osc.frequency.setValueAtTime(from, t);
    osc.frequency.exponentialRampToValueAtTime(to, t + dur);
    if (wobble) {
      const lfo = ctx.createOscillator();
      const depth = ctx.createGain();
      lfo.frequency.value = wobble;
      depth.gain.value = from * 0.08;
      lfo.connect(depth).connect(osc.frequency);
      lfo.start(t);
      lfo.stop(t + dur + 0.05);
    }
    gain.gain.setValueAtTime(0.0001, t);
    gain.gain.exponentialRampToValueAtTime(vol, t + 0.01);
    gain.gain.exponentialRampToValueAtTime(0.0001, t + dur);
    osc.connect(gain).connect(this.master!);
    osc.start(t);
    osc.stop(t + dur + 0.05);
  }

  /** Filtered noise sweeping from one pitch to another: whooshes, swishes and thuds. */
  private whoosh(from: number, to: number, dur: number, vol: number): void {
    const ctx = this.ctx!, t = ctx.currentTime;
    const src = ctx.createBufferSource();
    src.buffer = this.noiseBuffer;
    const filter = ctx.createBiquadFilter();
    filter.type = 'bandpass';
    filter.Q.value = 1.2;
    filter.frequency.setValueAtTime(from, t);
    filter.frequency.exponentialRampToValueAtTime(to, t + dur);
    const gain = ctx.createGain();
    gain.gain.setValueAtTime(0.0001, t);
    gain.gain.exponentialRampToValueAtTime(vol, t + dur * 0.3);
    gain.gain.exponentialRampToValueAtTime(0.0001, t + dur);
    src.connect(filter).connect(gain).connect(this.master!);
    src.start(t, Math.random() * 0.5);
    src.stop(t + dur + 0.05);
  }
}
