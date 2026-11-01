// Builds the level JSON files in public/levels from code.
// Run with: npm run levels
//
// Level design rule: every level is one path the cat can't leave. The sides
// are hedges with invisible barriers on top reaching to the sky (and hedges
// have no grip, so you can't wall-run past an obstacle on them). Obstacles
// span the whole path and pits have no way around, so every obstacle has to
// be beaten. Obstacle sizes come from obstacles.ts and are checked by tests.

import { mkdirSync, writeFileSync } from 'node:fs';
import type { LevelFile, Theme } from '../src/world/levelFormat.ts';
import { OBSTACLE as O } from './obstacles.ts';
import { CITY_STYLE, GARDEN_STYLE, MOON_STYLE, PathBuilder, rng, type PathStyle } from './pathBuilder.ts';

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

/** Low fences in a row to hop over. */
function hurdles(P: PathBuilder, count = 3): void {
  const len = 2 + count * 4;
  P.segment(len, () => {
    P.floor(0, len);
    for (let i = 0, f = 3; i < count; i++, f += 4) P.block(-P.half, f, P.half, f + 0.5, P.H, P.H + O.hurdle, 'wood', { round: 0.12 });
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

/** A plain drop down to a lower floor. */
function dropDown(P: PathBuilder, h: number): void {
  P.segment(10, () => {
    P.floor(0, 5);
    P.floor(5, 10, P.H - h, 'stone');
    P.H -= h;
  });
}

/**
 * A hill: small steps up, a flat top, and small steps down (maybe a
 * different amount, so hills also take the path up or down).
 */
function hill(P: PathBuilder, up: number, down: number, top = 4): void {
  const step = O.hillStep, d = O.hillStepDepth;
  const nUp = Math.round(up / step), nDown = Math.round(down / step);
  const len = 2 + (nUp + nDown) * d + top;
  P.segment(len, () => {
    P.floor(0, 1);
    let f = 1;
    for (let i = 1; i <= nUp; i++, f += d) P.floor(f, f + d, P.H + i * step);
    P.H += nUp * step;
    P.floor(f, f + top);
    P.prop('flowers', -P.half + 0.8, f + 1);
    P.prop('bush', P.half - 1, f + top - 1.2);
    f += top;
    for (let i = 1; i <= nDown; i++, f += d) P.floor(f, f + d, P.H - i * step);
    P.H -= nDown * step;
    P.floor(f, len);
  });
}

// ---------------------------------------------------------------- each level's own obstacle

/** A bouncy mushroom: a red cap on a white stem standing in the pit (or on the floor). */
function mushroom(P: PathBuilder, s: number, f: number, top: number, radius = 1.4): void {
  const capH = 0.45;
  P.pillar(s, f, 0.45, top - capH + 0.1, 'white');
  P.disc(s, f, radius, top - capH, capH, 'mushroom');
}

/** Garden: a cliff too tall to climb, with a mushroom in front to bounce up it. */
function mushroomCliff(P: PathBuilder): void {
  P.segment(16, () => {
    P.floor(0, 9.5);
    // Its top is just low enough to step onto, so even walking onto it bounces.
    mushroom(P, 0, 6.5, P.H + 0.28);
    P.floor(9.5, 16, P.H + O.mushroomCliff, 'stone');
    P.H += O.mushroomCliff;
  });
}

/** Garden: mushrooms across a long pit, bounce from one to the next. */
function mushroomPit(P: PathBuilder, count = 3): void {
  const spacing = 7.2, first = 4.8, end = first + (count - 1) * spacing + 2.8, len = end + 4;
  P.segment(len, () => {
    P.floor(0, 3);
    P.pit(3, end);
    for (let i = 0; i < count; i++) mushroom(P, [0, -1.5, 1.5][i % 3], first + i * spacing, P.H);
    P.floor(end, len);
  });
}

/** City: a hole with a fan at the bottom; its wind lifts you onto a tall rooftop. */
function fanLift(P: PathBuilder): void {
  P.segment(16, () => {
    P.floor(0, 4);
    P.floor(4, 10, P.H - O.fanDepth, 'vent');
    P.zone('updraft', -P.half, 4, P.half, 10, P.H - O.fanDepth, P.H + O.fanLift + 1.5);
    P.floor(10, 16, P.H + O.fanLift, 'stone');
    P.H += O.fanLift;
  });
}

/** City: a long drop lined with fans; float across on the wind. */
function fanGlide(P: PathBuilder): void {
  const len = 22, depth = 6;
  P.segment(len, () => {
    P.floor(0, 4);
    P.pit(4, 18);
    P.block(-P.half, 4, P.half, 18, P.base, P.H - depth, 'vent', { round: 0.04 });
    P.zone('updraft', -P.half, 4, P.half, 18, P.H - depth, P.H + 1.5);
    P.floor(18, len);
  });
}

/** Moon: a crater far too wide to jump, inside a low-gravity bubble. */
function craterLeap(P: PathBuilder): void {
  const len = 4 + O.craterGap + 5;
  P.segment(len, () => {
    P.floor(0, 4);
    P.pit(4, 4 + O.craterGap);
    P.floor(4 + O.craterGap, len);
    P.zone('lowGravity', -P.half, 0.5, P.half, len - 0.5, P.H - 4, P.H + 12);
  });
}

/** Moon: a cliff too tall to climb, inside a low-gravity bubble. */
function floatyCliff(P: PathBuilder): void {
  P.segment(14, () => {
    P.floor(0, 6);
    P.floor(6, 14, P.H + O.floatyCliff, 'stone');
    P.zone('lowGravity', -P.half, 0.5, P.half, 9, P.H - 1, P.H + O.floatyCliff + 6);
    P.H += O.floatyCliff;
  });
}

// ---------------------------------------------------------------- random layouts
// The themed levels are laid out from a seed: obstacles are picked from easy,
// medium and hard groups (so each level still gets harder as it goes), and
// turns, hills and drops land in random places. The same seed always makes the
// same level, so the saved JSON and the tests stay in step.

type Build = (P: PathBuilder, r: () => number) => void;

interface Obstacle {
  id: string;
  /** Most the floor goes up (meters). */
  up: number;
  /** Most it goes down. */
  down: number;
  build: Build;
}

const ob = (id: string, up: number, down: number, build: Build): Obstacle => ({ id, up, down, build });

const EASY: Obstacle[] = [
  ob('hurdles', 0, 0, (P, r) => hurdles(P, 2 + Math.floor(r() * 3))),
  ob('jumpUp', O.jumpUp, 0, (P) => jumpUp(P)),
  ob('gap', 0, 0, (P) => gap(P, O.gapJump)),
  ob('stumps', 0, 0, (P, r) => stumps(P, 3, 3.4 + r() * 0.4)),
  ob('plank', 0, 0, (P, r) => plank(P, 6 + Math.round(r() * 4))),
];

const MEDIUM: Obstacle[] = [
  ob('gapDouble', 0, 0, (P) => gap(P, O.gapDouble)),
  ob('ledgeDouble', O.ledgeDouble, 0, (P) => jumpUp(P, O.ledgeDouble, 'brick')),
  ob('wallRun', 0, 0, (P, r) => wallRun(P, r() < 0.5 ? -1 : 1)),
  ob('zigzag', 3.2, 0, (P) => zigzag(P, 3)),
  ob('gapRun', 0, 0, (P) => gapRun(P)),
  ob('downSteps', 0, 6, (P) => downSteps(P, 3)),
  ob('stumps4', 0, 0, (P, r) => stumps(P, 4, 4.2 + r() * 0.4)),
];

const HARD: Obstacle[] = [
  ob('gapDash', 0, 0, (P) => gap(P, O.gapDash)),
  ob('chimney', O.chimneyHeight, 0, (P) => chimney(P)),
  ob('ledgeGrab', O.ledgeGrab, 0, (P) => jumpUp(P, O.ledgeGrab, 'stone')),
  ob('doubleWallRun', 0, 0, (P) => doubleWallRun(P)),
  ob('tower', O.ledgeGrab + O.ledgeDouble, 0, (P) => tower(P)),
  ob('islandHop', 0, 0, (P) => islandHop(P)),
  ob('zigzag4', 4, 0, (P) => zigzag(P, 4)),
  ob('downSteps5', 0, 9, (P) => downSteps(P, 5)),
];

interface LevelSpec {
  name: string;
  theme: Theme;
  seed: number;
  style: PathStyle;
  startHeight: number;
  /** Lowest and highest floor height the path keeps to. */
  minH: number;
  maxH: number;
  /** Hills between obstacles. */
  hilly: boolean;
  /** This level's own obstacle, in an easy, a medium and a hard version. */
  special: [Obstacle, Obstacle, Obstacle];
}

const shuffle = <T>(list: T[], r: () => number): T[] => {
  const out = [...list];
  for (let i = out.length - 1; i > 0; i--) {
    const j = Math.floor(r() * (i + 1));
    [out[i], out[j]] = [out[j], out[i]];
  }
  return out;
};

/** 17 obstacles and the finale (18), five corners with checkpoints and two without. */
function layout(spec: LevelSpec, r: () => number): { file: LevelFile; builder: PathBuilder } {
  const P = new PathBuilder({ style: spec.style, startHeight: spec.startHeight });
  const count = 17;

  // Corners go after obstacles 1 to 15, checkpoint corners at least two obstacles apart.
  const checkpoints = new Set<number>();
  for (const i of shuffle([...Array(15).keys()].map((n) => n + 1), r)) {
    if (checkpoints.size < 5 && ![...checkpoints].some((c) => Math.abs(c - i) < 2)) checkpoints.add(i);
  }
  const plainTurns = new Set(shuffle([...Array(15).keys()].map((n) => n + 1).filter((n) => !checkpoints.has(n)), r).slice(0, 2));

  // Each band: its regular obstacles plus the level's own one, in a random order.
  const slots: (Obstacle[] | Obstacle)[] = [];
  ([[EASY, 4, 0], [MEDIUM, 5, 1], [HARD, 5, 2]] as const).forEach(([pool, n, s]) => {
    const band: (Obstacle[] | Obstacle)[] = [...Array(n).fill(pool), spec.special[s]];
    // The very first obstacle is always a regular easy one.
    slots.push(...(s === 0 ? [band[0], ...shuffle(band.slice(1), r)] : shuffle(band, r)));
  });

  const used = new Set<string>();
  startLawn(P);
  for (let i = 0; i < count; i++) {
    // Too high up: go back down first, down a long hill or off a ledge.
    if (P.H > spec.maxH - 7) {
      const drop = 3 + Math.round(r() * 2);
      if (spec.hilly) hill(P, 0.6, drop + 0.6);
      else dropDown(P, drop);
      P.plan.push('down');
    } else if (spec.hilly && r() < 0.5) {
      const up = 0.6 + r() * 1.8;
      const down = Math.min(Math.max(0.3, up - 1 + r() * 2), P.H + up - spec.minH);
      hill(P, up, down);
      P.plan.push('hill');
    }

    const slot = slots[i];
    let o: Obstacle;
    if (Array.isArray(slot)) {
      const fits = slot.filter((c) => !used.has(c.id) && P.H + c.up <= spec.maxH && P.H - c.down >= spec.minH);
      const open = slot.filter((c) => !used.has(c.id));
      const choices = fits.length ? fits : open;
      o = choices[Math.floor(r() * choices.length)];
      used.add(o.id);
    } else {
      o = slot;
    }
    o.build(P, r);
    P.plan.push(o.id);
    if (checkpoints.has(i + 1) || plainTurns.has(i + 1)) {
      const dir = r() < 0.5 ? 'left' : 'right';
      P.turn(dir, checkpoints.has(i + 1));
      P.plan.push(dir);
    }
  }
  finale(P);
  return { file: P.build(spec.name, spec.theme, spec.seed), builder: P };
}

/** Tries layouts from the seed until one doesn't run into itself and fits in a level. */
function randomLevel(spec: LevelSpec): { file: LevelFile; builder: PathBuilder } {
  for (let attempt = 0; attempt < 500; attempt++) {
    const r = rng(spec.seed * 7919 + attempt * 104729 + 1);
    for (let i = 0; i < 5; i++) r(); // the first few numbers from a small seed are all tiny
    try {
      const out = layout(spec, r);
      if (out.file.size[0] <= 250 && out.file.size[2] <= 250) return out;
    } catch (err) {
      if (!(err instanceof Error && err.message.startsWith('The path runs into itself'))) throw err;
    }
  }
  throw new Error(`Could not find a layout for ${spec.name} that fits. Try another seed.`);
}

// ---------------------------------------------------------------- levels

/** Garden Path: a long, winding, hilly hedge maze, with bouncy mushrooms. */
export function gardenLevel(): { file: LevelFile; builder: PathBuilder } {
  return randomLevel({
    name: 'Garden Path', theme: 'backyard', seed: 7, style: GARDEN_STYLE,
    startHeight: 10, minH: 10, maxH: 32, hilly: true,
    special: [
      ob('mushroomCliff', O.mushroomCliff, 0, (P) => mushroomCliff(P)),
      ob('mushroomPit', 0, 0, (P) => mushroomPit(P, 3)),
      ob('mushroomPitCliff', O.mushroomCliff, 0, (P) => { mushroomPit(P, 4); mushroomCliff(P); }),
    ],
  });
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

/** City Rooftops: high above the streets at sunset, with fans whose wind lifts you. */
export function cityLevel(): { file: LevelFile; builder: PathBuilder } {
  return randomLevel({
    name: 'City Rooftops', theme: 'city', seed: 11, style: CITY_STYLE,
    startHeight: 16, minH: 14, maxH: 34, hilly: false,
    special: [
      ob('fanLift', O.fanLift, 0, (P) => fanLift(P)),
      ob('fanGlide', 0, 0, (P) => fanGlide(P)),
      ob('fanGlideLift', O.fanLift, 0, (P) => { fanGlide(P); fanLift(P); }),
    ],
  });
}

/** Moon Base: dusty hills between force fields, with low-gravity bubbles. */
export function moonLevel(): { file: LevelFile; builder: PathBuilder } {
  return randomLevel({
    name: 'Moon Base', theme: 'moon', seed: 5, style: MOON_STYLE,
    startHeight: 10, minH: 10, maxH: 30, hilly: true,
    special: [
      ob('floatyCliff', O.floatyCliff, 0, (P) => floatyCliff(P)),
      ob('craterLeap', 0, 0, (P) => craterLeap(P)),
      ob('craterCliff', O.floatyCliff, 0, (P) => { craterLeap(P); floatyCliff(P); }),
    ],
  });
}

// Only write files when run as a script, not when tests import the levels.
if (process.argv[1]?.endsWith('build-levels.ts')) {
  save('garden.json', gardenLevel().file);
  save('gym.json', gymLevel().file);
  save('city.json', cityLevel().file);
  save('moon.json', moonLevel().file);
}
