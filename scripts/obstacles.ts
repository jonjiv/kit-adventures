// Obstacle sizes used by the levels. tests/player.test.ts checks each one
// needs the move it teaches and can be done with it, so if a tuning number
// changes, the tests say which obstacles stopped working.

export const OBSTACLE = {
  /** Low walls you must jump over (taller than auto-climb, lower than a jump). */
  hurdle: 1.3,
  /** A step up that needs a jump. */
  jumpUp: 1.6,
  /** Gap a running jump clears. */
  gapJump: 3.5,
  /** Gap that needs a double jump. */
  gapDouble: 5.5,
  /** Gap that needs a double jump and a dash. */
  gapDash: 7.5,
  /** Ledge that needs a double jump. */
  ledgeDouble: 2.4,
  /** Ledge too high to land on, so you double jump and grab it. */
  ledgeGrab: 3.8,
  /** Pit along a wall that's too long to cross without wall-running. */
  wallRunPit: 12,
  /** Walls that are too tall to grab the top of. */
  tallWall: 5,
  /** Space between the walls of a wall-jump chimney. */
  chimneyGap: 2.2,
  chimneyHeight: 7,
} as const;
