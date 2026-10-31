// Builds the level JSON files in public/levels from code.
// Run with: npm run levels

import { writeFileSync } from 'node:fs';
import { GridBuilder, type LevelFile } from '../src/world/levelFormat.ts';

function save(file: string, level: LevelFile): void {
  // Keep the long blocks list on one line so the rest of the file stays readable.
  const json = JSON.stringify({ ...level, blocks: '@BLOCKS@' }, null, 2)
    .replace('"@BLOCKS@"', JSON.stringify(level.blocks));
  writeFileSync(new URL(`../public/levels/${file}`, import.meta.url), json + '\n');
  console.log(`Wrote ${file}`);
}

/** Phase 1 test yard: flat ground with one of every block to look at. */
function testLevel(): LevelFile {
  const g = new GridBuilder([48, 24, 48]);
  // Ground: stone, dirt, grass. The top of the ground is y = 3.
  g.fill(0, 0, 0, 47, 0, 47, 'stone');
  g.fill(0, 1, 0, 47, 1, 47, 'dirt');
  g.fill(0, 2, 0, 47, 2, 47, 'grass');

  // Pond sunk into the ground.
  g.fill(12, 1, 26, 17, 2, 31, 'water');

  // Lava patch with a stone rim.
  g.fill(29, 2, 29, 33, 2, 33, 'stone');
  g.fill(30, 2, 30, 32, 2, 32, 'lava');

  // Carpet patch.
  g.fill(6, 2, 18, 11, 2, 23, 'carpet');

  // Wooden staircase.
  for (let i = 0; i < 5; i++) g.fill(18 + i, 3, 8, 18 + i, 3 + i, 10, 'wood');

  // Brick tower with glass windows and a roof.
  g.fill(30, 3, 10, 34, 10, 14, 'brick');
  g.fill(31, 6, 10, 33, 7, 10, 'glass');
  g.fill(30, 6, 11, 30, 7, 13, 'glass');
  g.fill(29, 11, 9, 35, 11, 15, 'roof');
  g.fill(30, 12, 10, 34, 12, 14, 'roof');
  g.fill(31, 13, 11, 33, 13, 13, 'roof');
  g.set(32, 14, 12, 'roof');

  // Tree.
  g.fill(38, 6, 36, 42, 8, 40, 'leaves');
  g.fill(39, 9, 37, 41, 9, 39, 'leaves');
  for (const [x, z] of [[38, 36], [42, 36], [38, 40], [42, 40]]) g.fill(x, 8, z, x, 8, z, 'air');
  g.fill(40, 3, 38, 40, 7, 38, 'wood');

  // Stone pillars getting taller, for jumping practice later.
  for (let i = 0; i < 5; i++) g.fill(6 + i * 3, 3, 40, 6 + i * 3, 3 + i, 40, 'stone');

  // Floating platforms.
  g.fill(22, 6, 20, 23, 6, 21, 'glass');
  g.fill(25, 8, 22, 26, 8, 23, 'wood');
  g.fill(28, 10, 20, 29, 10, 21, 'brick');

  // Two facing walls, for wall jumps later.
  g.fill(40, 3, 14, 40, 9, 24, 'brick');
  g.fill(44, 3, 14, 44, 9, 24, 'brick');

  g.add({ type: 'start', pos: [8, 3, 8], yaw: 0 });
  return g.toLevel('Test Yard', 'backyard');
}

save('test.json', testLevel());
