import { describe, expect, it } from 'vitest';
import { TUNING } from '../src/player/tuning';
import { formatTime, Race, type RaceEvent } from '../src/race/race';
import type { Vec3 } from '../src/world/levelFormat';

const DT = 1 / 60;
const GOAL: Vec3 = [10, 2, 10];
const AWAY: Vec3 = [0, 0, 0];

function steps(race: Race, n: number, feet: Vec3 = AWAY): RaceEvent[] {
  const events: RaceEvent[] = [];
  for (let i = 0; i < n; i++) {
    const e = race.step(DT, feet);
    if (e) events.push(e);
  }
  return events;
}

describe('race', () => {
  it('counts down 3, 2, 1 with a beep each, then says GO', () => {
    const race = new Race(GOAL);
    const banners = new Set<string>();
    const events: RaceEvent[] = [];
    for (let i = 0; i < TUNING.race.countdownSeconds * 60 + 1; i++) {
      banners.add(race.banner);
      const e = race.step(DT, AWAY);
      if (e) events.push(e);
    }
    expect([...banners]).toEqual(['3', '2', '1']);
    expect(events).toEqual(['beep', 'beep', 'beep', 'go']);
    expect(race.phase).toBe('running');
    expect(race.banner).toBe('GO!');
    expect(race.timeMs).toBe(0);
  });

  it('times the run and stops on the golden pad', () => {
    const race = new Race(GOAL);
    steps(race, TUNING.race.countdownSeconds * 60 + 1);
    expect(steps(race, 600)).toEqual([]);
    expect(race.timeMs).toBe(10000);
    expect(race.banner).toBe('');
    expect(race.step(DT, [10.5, 2, 9.2])).toBe('finish');
    expect(race.phase).toBe('finished');
    const time = race.timeMs;
    steps(race, 60, GOAL);
    expect(race.timeMs).toBe(time);
  });

  it('does not finish beside or under the pad, or during the countdown', () => {
    const race = new Race(GOAL);
    expect(steps(race, 30, GOAL)).not.toContain('finish');
    steps(race, TUNING.race.countdownSeconds * 60);
    expect(race.step(DT, [10 + TUNING.race.goalHalfSize + 0.2, 2, 10])).toBeNull();
    expect(race.step(DT, [10, 1, 10])).toBeNull();
    expect(race.step(DT, [10, 2 + TUNING.race.goalReach + 0.5, 10])).toBeNull();
    expect(race.phase).toBe('running');
  });

  it('writes times as minutes, seconds and hundredths', () => {
    expect(formatTime(0)).toBe('0:00.00');
    expect(formatTime(5432)).toBe('0:05.43');
    expect(formatTime(65320)).toBe('1:05.32');
    expect(formatTime(600000)).toBe('10:00.00');
  });
});
