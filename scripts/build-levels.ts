// Builds the level JSON files in public/levels from code.
// Run with: npm run levels
//
// Level design rule: every level is one path the cat can't leave. The sides
// are hedges with invisible barriers on top reaching to the sky (and hedges
// have no grip, so you can't wall-run past an obstacle on them). Obstacles
// span the whole path and pits have no way around, so every obstacle has to
// be beaten. Obstacle sizes come from obstacles.ts and are checked by tests.

import { mkdirSync, writeFileSync } from 'node:fs';
import type { LevelFile } from '../src/world/levelFormat.ts';
import { OBSTACLE as O } from './obstacles.ts';
import { CITY_STYLE, MOON_STYLE, PathBuilder } from './pathBuilder.ts';

function save(file: string, level: LevelFile): void {
  mkdirSync(new URL('../public/levels/', import.meta.url), { recursive: true });
  writeFileSync(new URL(`../public/levels/${file}`, import.meta.url), JSON.stringify(level) + '\n');
  console.log(`Wrote ${file} (${level.pieces.length} pieces, ${level.size.join(' x ')} m)`);
}

// ---------------------------------------------------------------- obstacles
// Each one is a segment of path. `P.H` is the floor height when it starts and
// is updated when an obstacle goes up or down.

function startLawn(P: PathBuilder, len = 10): void {
  P.cap(true);
  P.segment(len, () => {
    P.floor(0, len);
    P.start(3);
    P.prop('flowers', -P.half + 0.8, 1.5);
    P.prop('flowers', P.half - 0.8, 6);
  });
}

/** Three low fences in a row to hop over. */
function hurdles(P: PathBuilder): void {
  P.segment(14, () => {
    P.floor(0, 14);
    for (const f of [3, 7, 11]) P.block(-P.half, f, P.half, f + 0.5, P.H, P.H + O.hurdle, 'wood', { round: 0.12 });
  });
}

/** A step up too tall to climb, so you jump. */
function jumpUp(P: PathBuilder, height: number = O.jumpUp, mat: 'wood' | 'brick' | 'stone' = 'wood'): void {
  P.segment(8, () => {
    P.floor(0, 4);
    P.floor(4, 8, P.H + height, mat);
    P.H += height;
  });
}

/** A gap across the path. */
function gap(P: PathBuilder, size: number): void {
  P.segment(size + 6, () => {
    P.floor(0, 3);
    P.pit(3, 3 + size);
    P.floor(3 + size, size + 6);
  });
}

/** Tree stumps over a pit, zig-zagging left and right. */
function stumps(P: PathBuilder, count: number, spacing: number): void {
  const len = 6 + count * spacing;
  P.segment(len, () => {
    P.floor(0, 3);
    P.pit(3, len - 3);
    for (let i = 0; i < count; i++) P.pillar(i % 2 ? 1.5 : -1.5, 3 + spacing * (i + 0.5), 1, P.H);
    P.floor(len - 3, len);
  });
}

/** A narrow plank over a pit. */
function plank(P: PathBuilder, len = 8): void {
  P.segment(len + 4, () => {
    P.floor(0, 2);
    P.pit(2, 2 + len);
    P.block(-0.45, 2, 0.45, 2 + len, P.H - 0.4, P.H, 'wood', { round: 0.08 });
    P.floor(2 + len, len + 4);
  });
}

/** A long pit with a tall brick wall on one side: wall-run along it. */
function wallRun(P: PathBuilder, side: -1 | 1): void {
  const len = O.wallRunPit + 8;
  P.segment(len, () => {
    P.floor(0, 4);
    P.pit(4, 4 + O.wallRunPit);
    const s0 = side < 0 ? -P.half : P.half - 1;
    P.block(s0, 2, s0 + 1, 6 + O.wallRunPit, P.base, P.H + O.tallWall, 'brick');
    P.floor(4 + O.wallRunPit, len);
  });
}

/** Two short walls on opposite sides over a pit: wall-run, wall-jump across, wall-run again. */
function doubleWallRun(P: PathBuilder): void {
  const len = 24;
  P.segment(len, () => {
    P.floor(0, 4);
    P.pit(4, 20);
    P.block(-2.5, 3, -1.5, 12.5, P.base, P.H + O.tallWall, 'brick');
    P.block(1.5, 10.5, 2.5, 21, P.base, P.H + O.tallWall, 'brick');
    P.floor(20, len);
  });
}

/** Three gaps in a row, each bigger: jump, jump, then double jump. */
function gapRun(P: PathBuilder): void {
  const a = O.gapJump, b = O.gapJump, c = O.gapDouble, len = 3 + a + 3 + b + 3 + c + 3;
  P.segment(len, () => {
    let f = 0;
    for (const size of [a, b, c]) {
      P.floor(f, f + 3);
      P.pit(f + 3, f + 3 + size);
      f += 3 + size;
    }
    P.floor(f, len);
  });
}

/** Small platforms rising in a zig-zag over a pit. */
function zigzag(P: PathBuilder, count = 3): void {
  const spacing = 4, len = 6 + count * spacing + 2;
  P.segment(len, () => {
    P.floor(0, 3);
    P.pit(3, len - 3);
    for (let i = 0; i < count; i++) {
      const s = i % 2 ? 1.8 : -1.8, f = 3 + 1.5 + i * spacing + 1.3;
      P.block(s - 1.3, f - 1.3, s + 1.3, f + 1.3, P.base, P.H + 0.8 * (i + 1), 'wood');
    }
    P.H += 0.8 * (count + 1);
    P.floor(len - 3, len, P.H, 'wood');
  });
}

/** Stepping stones going down over a pit. */
function downSteps(P: PathBuilder, count = 4): void {
  const spacing = 4.2, len = 6 + count * spacing;
  P.segment(len, () => {
    P.floor(0, 3, P.H, 'stone');
    P.pit(3, len - 3);
    for (let i = 0; i < count; i++) {
      const s = i % 2 ? 1.5 : -1.5, f = 3 + spacing * (i + 0.5);
      P.block(s - 1.4, f - 1.4, s + 1.4, f + 1.4, P.base, P.H - 1.5 * (i + 1), 'stone');
    }
    P.H -= 1.5 * (count + 1);
    P.floor(len - 3, len, P.H, 'stone');
  });
}

/** A tall cliff with a narrow slot: wall-jump up between the slot's walls. */
function chimney(P: PathBuilder): void {
  const c = O.chimneyGap / 2, len = 12, top = P.H + O.chimneyHeight;
  P.segment(len, () => {
    P.floor(0, 5);
    P.block(-P.half, 3, -c, 6, P.base, top, 'stone');
    P.block(c, 3, P.half, 6, P.base, top, 'stone');
    P.block(-c, 5, c, 6, P.base, top, 'leaves'); // hedge at the back: no grip, so holding forward can't kick you out
    P.H = top;
    P.floor(6, len, P.H, 'stone');
  });
}

/** Ledge grab, then straight into a double-jump ledge. */
function tower(P: PathBuilder): void {
  P.segment(14, () => {
    P.floor(0, 4);
    P.floor(4, 9, P.H + O.ledgeGrab, 'brick');
    P.floor(9, 14, P.H + O.ledgeGrab + O.ledgeDouble, 'brick');
    P.H += O.ledgeGrab + O.ledgeDouble;
  });
}

/** A double-jump gap to a small island, then a dash gap. */
function islandHop(P: PathBuilder): void {
  const a = O.gapDouble, b = O.gapDash, len = 3 + a + 3 + b + 4;
  P.segment(len, () => {
    P.floor(0, 3);
    P.pit(3, 3 + a);
    P.floor(3 + a, 6 + a, P.H, 'stone');
    P.pit(6 + a, 6 + a + b);
    P.floor(6 + a + b, len);
  });
}

/** Crates rising like stairs over a pit to the goal. */
function finale(P: PathBuilder, label?: string): void {
  const count = 4, spacing = 4.4, len = 3 + count * spacing + 10;
  P.segment(len, () => {
    P.floor(0, 3);
    P.pit(3, 3 + count * spacing + 1);
    for (let i = 0; i < count; i++) {
      const f = 3 + 2.5 + i * spacing + 1.2;
      P.block(-1.2, f - 1.2, 1.2, f + 1.2, P.base, P.H + 1.2 * (i + 1), 'wood');
    }
    P.H += 1.2 * (count + 1);
    const end = 3 + count * spacing + 1;
    P.floor(end, len);
    // Golden pad where the rainbow portal will go (Phase 4).
    P.block(-1.5, len - 6, 1.5, len - 3, P.H, P.H + 0.2, 'yellow', { round: 0.1 });
    P.markGoal(0, len - 4.5);
    P.prop('flowers', -P.half + 0.8, len - 2);
    P.prop('flowers', P.half - 0.8, len - 7);
    if (label) P.sign(end + 1, label);
  });
  P.cap();
}

// ---------------------------------------------------------------- levels

/** Garden Path: a long, winding hedge maze with 18 obstacles using every move. */
export function gardenLevel(): { file: LevelFile; builder: PathBuilder } {
  const P = new PathBuilder();
  startLawn(P);
  hurdles(P); // 1
  jumpUp(P); // 2
  gap(P, O.gapJump); // 3
  P.turn('right', true);
  stumps(P, 3, 3.6); // 4
  jumpUp(P, O.ledgeDouble, 'brick'); // 5
  plank(P); // 6
  P.turn('left', true);
  gap(P, O.gapDouble); // 7
  wallRun(P, -1); // 8
  jumpUp(P, O.ledgeGrab, 'stone'); // 9
  P.turn('left', true);
  zigzag(P); // 10
  gap(P, O.gapDash); // 11
  chimney(P); // 12
  P.turn('right', true);
  downSteps(P); // 13
  doubleWallRun(P); // 14
  tower(P); // 15
  P.turn('right', true);
  stumps(P, 4, 4.6); // 16
  islandHop(P); // 17
  finale(P); // 18
  return { file: P.build('Garden Path', 'backyard', 7), builder: P };
}

/** Parkour Gym: one station per move, each with a sign and a checkpoint. */
export function gymLevel(): { file: LevelFile; builder: PathBuilder } {
  const P = new PathBuilder();
  startLawn(P, 8);
  P.segment(6, () => {
    P.floor(0, 6);
    P.sign(3, 'Parkour Gym!');
  });
  const station = (text: string, build: () => void) => {
    P.segment(6, () => {
      P.floor(0, 6);
      P.checkpoint(2.5);
      P.sign(4, text);
    });
    build();
  };
  station('Jump!\nHold Space', () => jumpUp(P));
  station('Double jump!\nSpace again in the air', () => jumpUp(P, O.ledgeDouble, 'brick'));
  station('Run into low walls\nto climb them', () => jumpUp(P, 1, 'wood'));
  P.turn('right');
  station('Ledge grab!\nDouble jump and hang', () => jumpUp(P, O.ledgeGrab, 'stone'));
  station('Wall run!\nJump at the wall at an angle', () => wallRun(P, -1));
  P.turn('left');
  station('Wall jump!\nSpace when touching a wall', () => chimney(P));
  station('Dash!\nShift in the air', () => gap(P, O.gapDash));
  finale(P, 'You did it!');
  return { file: P.build('Parkour Gym', 'backyard', 3), builder: P };
}

/** City Rooftops: run and jump across the rooftops at sunset, 18 obstacles. */
export function cityLevel(): { file: LevelFile; builder: PathBuilder } {
  const P = new PathBuilder({ style: CITY_STYLE });
  startLawn(P);
  hurdles(P); // 1: air vents
  gapRun(P); // 2: gaps between buildings
  jumpUp(P, O.ledgeDouble, 'brick'); // 3
  P.turn('left', true);
  wallRun(P, 1); // 4
  stumps(P, 3, 3.6); // 5: poles
  plank(P); // 6: a steel beam
  P.turn('right', true);
  jumpUp(P, O.ledgeGrab, 'stone'); // 7
  gap(P, O.gapDash); // 8
  chimney(P); // 9
  P.turn('right', true);
  downSteps(P); // 10
  doubleWallRun(P); // 11
  zigzag(P); // 12: fire escape
  P.turn('left', true);
  islandHop(P); // 13
  tower(P); // 14
  stumps(P, 4, 4.6); // 15
  P.turn('left', true);
  gap(P, O.gapDouble); // 16
  hurdles(P); // 17
  finale(P); // 18
  return { file: P.build('City Rooftops', 'city', 11), builder: P };
}

/** Moon Base: dusty paths between force fields, under the stars and the Earth, 18 obstacles. */
export function moonLevel(): { file: LevelFile; builder: PathBuilder } {
  const P = new PathBuilder({ style: MOON_STYLE });
  startLawn(P);
  jumpUp(P); // 1
  stumps(P, 3, 3.6); // 2: metal pylons
  gap(P, O.gapDouble); // 3
  P.turn('right', true);
  zigzag(P); // 4
  wallRun(P, -1); // 5
  jumpUp(P, O.ledgeGrab, 'stone'); // 6
  P.turn('right', true);
  plank(P); // 7
  islandHop(P); // 8
  chimney(P); // 9
  P.turn('left', true);
  downSteps(P); // 10
  gapRun(P); // 11
  doubleWallRun(P); // 12
  P.turn('left', true);
  tower(P); // 13
  gap(P, O.gapDash); // 14
  hurdles(P); // 15
  P.turn('left', true);
  stumps(P, 4, 4.6); // 16
  jumpUp(P, O.ledgeDouble, 'brick'); // 17
  finale(P); // 18
  return { file: P.build('Moon Base', 'moon', 5), builder: P };
}

// Only write files when run as a script, not when tests import the levels.
if (process.argv[1]?.endsWith('build-levels.ts')) {
  save('garden.json', gardenLevel().file);
  save('gym.json', gymLevel().file);
  save('city.json', cityLevel().file);
  save('moon.json', moonLevel().file);
}
