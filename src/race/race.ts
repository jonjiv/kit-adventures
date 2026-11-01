// The race in every level: a 3-2-1 countdown with the cat held still, then a
// timer that runs until the cat stands on the golden pad at the end.

import { TUNING } from '../player/tuning';
import type { Vec3 } from '../world/levelFormat';

export type RacePhase = 'countdown' | 'running' | 'finished';
/** 'beep' for each of 3, 2 and 1, 'go' when the race starts, 'finish' on the golden pad. */
export type RaceEvent = 'beep' | 'go' | 'finish';

export class Race {
  phase: RacePhase = 'countdown';
  /** Seconds left before GO. */
  countdown: number = TUNING.race.countdownSeconds;
  /** Seconds since GO (stops at the finish). */
  elapsed = 0;
  private goal: Vec3 | null;
  private started = false;

  constructor(goal: Vec3 | null) {
    this.goal = goal;
  }

  /** Moves the race on by one physics step. `feet` is where the cat is standing. */
  step(dt: number, feet: Vec3): RaceEvent | null {
    if (this.phase === 'countdown') {
      if (!this.started) {
        this.started = true;
        return 'beep';
      }
      const before = Math.ceil(this.countdown);
      this.countdown -= dt;
      // (A hair above zero counts, so rounding in the step sizes never adds an extra step.)
      if (this.countdown <= 1e-6) {
        this.countdown = 0;
        this.phase = 'running';
        return 'go';
      }
      return Math.ceil(this.countdown) < before ? 'beep' : null;
    }
    if (this.phase === 'running') {
      this.elapsed += dt;
      if (this.onGoal(feet)) {
        this.phase = 'finished';
        return 'finish';
      }
    }
    return null;
  }

  /** The time in whole milliseconds. */
  get timeMs(): number {
    return Math.round(this.elapsed * 1000);
  }

  /** The big words in the middle of the screen: 3, 2, 1, GO!, or nothing. */
  get banner(): string {
    if (this.phase === 'countdown') return String(Math.max(1, Math.ceil(this.countdown)));
    if (this.phase === 'running' && this.elapsed < TUNING.race.goShowSeconds) return 'GO!';
    return '';
  }

  private onGoal(feet: Vec3): boolean {
    if (!this.goal) return false;
    const r = TUNING.race;
    const [gx, gy, gz] = this.goal;
    return Math.abs(feet[0] - gx) <= r.goalHalfSize && Math.abs(feet[2] - gz) <= r.goalHalfSize &&
      feet[1] >= gy - 0.1 && feet[1] <= gy + r.goalReach;
  }
}

/** A time like 1:05.32 (minutes, seconds, hundredths). */
export function formatTime(ms: number): string {
  const hundredths = Math.floor(ms / 10);
  const minutes = Math.floor(hundredths / 6000);
  const seconds = Math.floor(hundredths / 100) % 60;
  return `${minutes}:${String(seconds).padStart(2, '0')}.${String(hundredths % 100).padStart(2, '0')}`;
}
