// Builds the level JSON files in public/levels from code.
// Run with: npm run levels
//
// Level design rule: every level is one path the cat can't leave. The sides
// are walls (hedges, fences, buildings) with invisible barriers on top
// reaching to the sky, obstacles span the whole path, and pits have no way
// around. So every obstacle has to be beaten to get to the portal.

import { writeFileSync } from 'node:fs';
import { LevelBuilder, type LevelFile } from '../src/world/levelFormat.ts';

function save(file: string, level: LevelFile): void {
  writeFileSync(new URL(`../public/levels/${file}`, import.meta.url), JSON.stringify(level, null, 1) + '\n');
  console.log(`Wrote ${file} (${level.pieces.length} pieces)`);
}

/**
 * Test Path: a hedge-lined garden path that runs toward -Z. Teaches running,
 * a jump up, a gap, a double-jump ledge and stepping stumps over a pit.
 */
export function testLevel(): LevelFile {
  const L = new LevelBuilder([40, 40, 96]);
  const PATH_X0 = 14, PATH_X1 = 26; // the path between the hedges
  const BOTTOM = -6;

  // Ground outside the hedges (just for looks; the cat can't get there).
  L.box(0, BOTTOM, 0, 12, 0, 96, 'grass');
  L.box(28, BOTTOM, 0, 40, 0, 96, 'grass');
  L.box(12, BOTTOM, 94, 28, 0, 96, 'grass');
  L.box(12, BOTTOM, 0, 28, 0, 6, 'grass');

  // Hedge walls all around the path, too tall to see over from the path.
  L.wall(12, BOTTOM, 6, PATH_X0, 6, 94, 'leaves');
  L.wall(PATH_X1, BOTTOM, 6, 28, 6, 94, 'leaves');
  L.wall(PATH_X0, BOTTOM, 92, PATH_X1, 6, 94, 'leaves');
  L.wall(PATH_X0, BOTTOM, 6, PATH_X1, 6, 8, 'leaves');

  // 1. Start lawn.
  L.box(PATH_X0, BOTTOM, 74, PATH_X1, 0, 92, 'grass');
  L.prop('flowers', 15.2, 0, 90);
  L.prop('flowers', 24.8, 0, 85);
  L.prop('rock', 24.2, 0, 78.5);

  // 2. Wooden deck one meter up: jump onto it.
  L.box(PATH_X0, BOTTOM, 60, PATH_X1, 1, 74, 'wood');
  L.box(15, 1, 63, 16.2, 2.2, 64.2, 'wood');

  // 3. Gap (fall in and you start over), then a stone landing.
  L.box(PATH_X0, BOTTOM, 44, PATH_X1, 1, 56.5, 'stone');

  // 4. Brick ledge 2.4 meters up: too high for one jump, so double jump.
  L.box(PATH_X0, BOTTOM, 36, PATH_X1, 3.4, 44, 'brick');

  // 5. Tree stumps over a pit.
  for (const [x, z] of [[18.5, 32.5], [21.5, 28.5], [18.5, 24.5]]) L.cylinder(x, BOTTOM, z, 1, 3.4 - BOTTOM, 'bark');

  // 6. Finish lawn with a golden pad where the portal will go.
  L.box(PATH_X0, BOTTOM, 8, PATH_X1, 3.4, 22, 'grass');
  L.box(18.5, 3.4, 11.5, 21.5, 3.6, 14.5, 'yellow', { round: 0.1 });
  L.prop('flowers', 15.5, 3.4, 20);
  L.prop('flowers', 24.5, 3.4, 9.5);

  // Scenery outside the hedges.
  L.box(2, 0, 38, 10, 0.25, 50, 'stone', { round: 0.12 });
  L.water(2.5, 0.05, 38.5, 9.5, 0.3, 49.5);
  for (const [x, z] of [[6, 80], [34, 70], [5, 20], [35, 30], [34, 88], [6, 58], [33, 50], [7, 4], [20, 2]]) {
    L.prop('tree', x, 0, z, 0, 1 + ((x * 7 + z) % 5) / 10);
  }
  for (const [x, z] of [[9.5, 70], [30.5, 52], [9, 30], [31, 15], [10, 90]]) L.prop('bush', x, 0, z);
  for (const [x, z] of [[3, 66], [37, 40]]) L.prop('rock', x, 0, z, 90);
  for (const [x, z] of [[10, 45], [31, 75], [4, 10]]) L.prop('flowers', x, 0, z);

  L.add({ type: 'start', pos: [20, 0, 88], yaw: 0 });
  return L.toLevel('Test Path', 'backyard');
}

// Only write files when run as a script, not when tests import the levels.
if (process.argv[1]?.endsWith('build-levels.ts')) {
  save('test.json', testLevel());
}
